class AudioProcessor extends AudioWorkletProcessor {

  process(inputs) {

    const input = inputs[0]

    if (!input || input.length === 0) return true

    const channel = input[0]

    const pcm = new Int16Array(channel.length)

    for (let i = 0; i < channel.length; i++) {
      pcm[i] = Math.max(-1, Math.min(1, channel[i])) * 0x7fff
    }

    this.port.postMessage(pcm)

    return true
  }
}

registerProcessor("audio-processor", AudioProcessor)