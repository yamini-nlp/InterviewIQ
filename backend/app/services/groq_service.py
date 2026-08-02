from groq import AsyncGroq
from app.config import settings
from app.core import metrics
import json
import re
import asyncio
import logging
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

_groq_client = None


def get_groq_client() -> AsyncGroq:
    global _groq_client
    if _groq_client is None:
        _groq_client = AsyncGroq(api_key=settings.groq_api_key)
    return _groq_client


def _reasoning_kwargs(model: str) -> dict:
    if model.startswith("openai/gpt-oss"):
        return {"extra_body": {"reasoning_effort": "low", "include_reasoning": False}}
    return {}


async def call_groq(
    prompt: str,
    model: str = "openai/gpt-oss-120b",
    max_tokens: int = 2048,
    temperature: float = 0.7,
    retries: int = 3,
) -> str:
    client = get_groq_client()
    last_error = None
    for attempt in range(retries):
        try:
            response = await asyncio.wait_for(
                client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=max_tokens,
                    temperature=temperature,
                    **_reasoning_kwargs(model),
                ),
                timeout=30.0,
            )
            return response.choices[0].message.content
        except asyncio.TimeoutError:
            last_error = Exception(
                f"Groq call timed out after 30s on attempt {attempt + 1}"
            )
            logger.warning(f"Groq timeout on attempt {attempt + 1} (model={model})")
            if attempt < retries - 1:
                await asyncio.sleep(1.0)
        except Exception as e:
            last_error = e
            err_str = str(e).lower()
            wait = (
                2 ** attempt
                if "rate_limit" in err_str or "429" in err_str
                else 0.5
            )
            logger.warning(
                f"Groq call attempt {attempt + 1} failed: {e}. Retrying in {wait}s"
            )
            if attempt < retries - 1:
                await asyncio.sleep(wait)
    metrics.record_groq_error(operation="call_groq")
    logger.error(f"Groq call failed after {retries} attempts (model={model}): {last_error}")
    raise last_error


async def call_groq_json(
    prompt: str,
    max_tokens: int = 2048,
    retries: int = 3,
    model: str = "openai/gpt-oss-120b",
) -> dict:
    last_error = None
    for attempt in range(retries):
        try:
            raw = await call_groq(
                prompt, model=model, max_tokens=max_tokens, temperature=0.3
            )
            cleaned = re.sub(r"```json\s*|\s*```", "", raw).strip()
            match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if match:
                cleaned = match.group(0)
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            last_error = Exception(
                f"JSON parse failed attempt {attempt + 1}: {e}"
            )
            logger.warning(f"JSON parse error on attempt {attempt + 1}: {e}")
            await asyncio.sleep(0.5)
        except Exception as e:
            last_error = e
            await asyncio.sleep(0.5)
    metrics.record_groq_error(operation="call_groq_json")
    logger.error(f"Groq JSON call failed after {retries} attempts (model={model}): {last_error}")
    raise last_error


async def stream_groq(
    prompt: str,
    model: str = "openai/gpt-oss-120b",
    max_tokens: int = 512,
    temperature: float = 0.5,
) -> AsyncGenerator[str, None]:
    client = get_groq_client()
    try:
        stream = await asyncio.wait_for(
            client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=temperature,
                stream=True,
                **_reasoning_kwargs(model),
            ),
            timeout=10.0,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
    except asyncio.TimeoutError:
        metrics.record_groq_error(operation="stream_groq")
        logger.warning("stream_groq timed out waiting for first chunk")
        raise
    except Exception as e:
        metrics.record_groq_error(operation="stream_groq")
        logger.error(f"stream_groq call failed (model={model}): {e}", exc_info=True)
        raise


async def transcribe_audio(
    audio_bytes: bytes, filename: str = "audio.webm"
) -> str:
    client = get_groq_client()
    try:
        transcription = await asyncio.wait_for(
            client.audio.transcriptions.create(
                file=(filename, audio_bytes, "audio/webm"),
                model="whisper-large-v3",
                language="en",
            ),
            timeout=60.0,
        )
        return transcription.text
    except asyncio.TimeoutError:
        metrics.record_groq_error(operation="transcribe_audio")
        logger.warning("Audio transcription timed out after 60s")
        raise Exception("Audio transcription timed out after 60s")
    except Exception as e:
        metrics.record_groq_error(operation="transcribe_audio")
        logger.error(f"Audio transcription failed: {e}", exc_info=True)
        raise