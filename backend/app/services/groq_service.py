from groq import AsyncGroq
from app.config import settings
import json
import re
import asyncio

groq_client = AsyncGroq(api_key=settings.groq_api_key)


async def call_groq(
    prompt: str,
    model: str = "llama-3.3-70b-versatile",
    max_tokens: int = 2048,
    temperature: float = 0.7,
    retries: int = 3,
) -> str:
    last_error = None
    for attempt in range(retries):
        try:
            response = await groq_client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return response.choices[0].message.content
        except Exception as e:
            last_error = e
            err_str = str(e).lower()
            if "rate_limit" in err_str or "429" in err_str:
                await asyncio.sleep(2 ** attempt)
            elif attempt < retries - 1:
                await asyncio.sleep(0.5)
            else:
                break
    raise last_error


async def call_groq_json(prompt: str, max_tokens: int = 2048, retries: int = 3) -> dict:
    last_error = None
    for attempt in range(retries):
        try:
            raw = await call_groq(prompt, max_tokens=max_tokens, temperature=0.3)
            cleaned = re.sub(r"```json\s*|\s*```", "", raw).strip()
            # Extract JSON object if surrounded by text
            match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if match:
                cleaned = match.group(0)
            return json.loads(cleaned)
        except json.JSONDecodeError:
            last_error = Exception(f"JSON parse failed on attempt {attempt + 1}")
            await asyncio.sleep(0.5)
        except Exception as e:
            last_error = e
            await asyncio.sleep(0.5)
    raise last_error


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    transcription = await groq_client.audio.transcriptions.create(
        file=(filename, audio_bytes, "audio/webm"),
        model="whisper-large-v3",
        language="en",
    )
    return transcription.text