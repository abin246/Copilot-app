let audioContext: AudioContext | null = null
let mediaStream: MediaStream | null = null

export async function startMic(ws: WebSocket) {
  if (audioContext) return

  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })

  const ctx = new AudioContext({ sampleRate: 16000 })
  audioContext = ctx

  await ctx.audioWorklet.addModule("/audio-processor.js")

  const source = ctx.createMediaStreamSource(mediaStream)
  const node = new AudioWorkletNode(ctx, "audio-processor")

  node.port.onmessage = (event) => {
    const pcm = event.data as Int16Array

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(pcm.buffer)
    }
  }

  source.connect(node)
}

export function stopMic() {
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop())
    mediaStream = null
  }
}