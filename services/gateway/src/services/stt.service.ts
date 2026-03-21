import axios from "axios";

const STT_API = process.env.STT_API || "http://localhost:8001/transcribe";

export async function transcribeAudio(buffer: Buffer) {
  const res = await axios.post(
    STT_API,
    buffer,
    {
      headers: {
        "Content-Type": "application/octet-stream",
      },
      transformRequest: [(data) => data],
    }
  );

  return res.data.text || "";
}
