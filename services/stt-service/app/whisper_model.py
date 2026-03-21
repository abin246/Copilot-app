from faster_whisper import WhisperModel

model = WhisperModel(
    "small",
    device="cpu",
    compute_type="int8"
)


def transcribe_audio(audio_path: str) -> str:
    segments, _ = model.transcribe(
        audio_path,
        beam_size=5
    )

    result = ""

    for segment in segments:
        result += segment.text + " "

    return result.strip()