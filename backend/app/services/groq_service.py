from groq import AsyncGroq
from app.config import settings
import json
import re
import asyncio
import logging

logger = logging.getLogger(__name__)

_groq_client = None


def get_groq_client() -> AsyncGroq:
    global _groq_client
    if _groq_client is None:
        _groq_client = AsyncGroq(api_key=settings.groq_api_key)
    return _groq_client


async def call_groq(
    prompt: str,
    model: str = "llama-3.3-70b-versatile",
    max_tokens: int = 2048,
    temperature: float = 0.7,
    retries: int = 3,
) -> str:
    client = get_groq_client()
    last_error = None
    for attempt in range(retries):
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return response.choices[0].message.content
        except Exception as e:
            last_error = e
            err_str = str(e).lower()
            wait = 2 ** attempt if "rate_limit" in err_str or "429" in err_str else 0.5
            logger.warning(f"Groq call attempt {attempt + 1} failed: {e}. Retrying in {wait}s")
            if attempt < retries - 1:
                await asyncio.sleep(wait)
    raise last_error


async def call_groq_json(prompt: str, max_tokens: int = 2048, retries: int = 3) -> dict:
    last_error = None
    for attempt in range(retries):
        try:
            raw = await call_groq(prompt, max_tokens=max_tokens, temperature=0.3)
            cleaned = re.sub(r"```json\s*|\s*```", "", raw).strip()
            match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if match:
                cleaned = match.group(0)
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            last_error = Exception(f"JSON parse failed attempt {attempt + 1}: {e}")
            logger.warning(f"JSON parse error on attempt {attempt + 1}: {e}")
            await asyncio.sleep(0.5)
        except Exception as e:
            last_error = e
            await asyncio.sleep(0.5)
    raise last_error


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    client = get_groq_client()
    transcription = await client.audio.transcriptions.create(
        file=(filename, audio_bytes, "audio/webm"),
        model="whisper-large-v3",
        language="en",
    )
    return transcription.text