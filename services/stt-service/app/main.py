from fastapi import FastAPI, Request, HTTPException
import os
import numpy as np
from faster_whisper import WhisperModel

app = FastAPI()

MODEL_NAME = os.getenv("STT_MODEL", "small.en")
BEAM_SIZE = int(os.getenv("STT_BEAM_SIZE", "2"))
BEST_OF = int(os.getenv("STT_BEST_OF", "2"))
TEMPERATURE = float(os.getenv("STT_TEMPERATURE", "0"))
VAD_FILTER = os.getenv("STT_VAD_FILTER", "true").lower() == "true"

model = WhisperModel(
    MODEL_NAME,
    device="cpu",
    compute_type="int8",
)


@app.post("/transcribe")
async def transcribe(request: Request):
    audio_bytes = await request.body()

    if not audio_bytes:
        return {"text": ""}

    # Guardrail: the backend expects raw 16-bit PCM little-endian. If we receive a
    # container format (webm/ogg/wav/etc), interpreting those bytes as PCM yields
    # nonsense transcripts.
    if looks_like_container_audio(audio_bytes):
        raise HTTPException(
            status_code=415,
            detail="Expected raw 16-bit PCM little-endian audio bytes (application/octet-stream), not a container format (webm/ogg/wav/etc).",
        )

    # Ensure buffer length is even for int16 samples
    if len(audio_bytes) % 2 != 0:
        audio_bytes = audio_bytes[:-1]

    # Convert 16-bit PCM little-endian to float32 in [-1, 1]
    audio = np.frombuffer(audio_bytes, dtype="<i2").astype(np.float32) / 32768.0

    segments, _ = model.transcribe(
        audio,
        language="en",
        beam_size=max(1, BEAM_SIZE),
        best_of=max(1, BEST_OF),
        temperature=TEMPERATURE,
        vad_filter=VAD_FILTER,
        vad_parameters={"min_silence_duration_ms": 250},
        condition_on_previous_text=False,
    )

    text = ""
    for seg in segments:
        text += seg.text + " "

    return {"text": text.strip()}


def looks_like_container_audio(b: bytes) -> bool:
    # WAV: RIFF....WAVE
    if len(b) >= 12 and b[0:4] == b"RIFF" and b[8:12] == b"WAVE":
        return True

    # OGG: OggS
    if len(b) >= 4 and b[0:4] == b"OggS":
        return True

    # FLAC: fLaC
    if len(b) >= 4 and b[0:4] == b"fLaC":
        return True

    # MP3: ID3
    if len(b) >= 3 and b[0:3] == b"ID3":
        return True

    # WebM/Matroska: EBML header + DocType "webm" or "matroska" early in the file.
    if len(b) >= 4 and b[0:4] == b"\x1a\x45\xdf\xa3":
        head = b[:1024].lower()
        if b"webm" in head or b"matroska" in head:
            return True

    return False
