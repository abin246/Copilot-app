// /* global AudioWorkletProcessor, registerProcessor, sampleRate */

// class Pcm16Processor extends AudioWorkletProcessor {
//   constructor(options) {
//     super();

//     const opts = (options && options.processorOptions) || {};
//     this._targetSampleRate = opts.targetSampleRate || 16000;
//     this._chunkMs = opts.chunkMs || 800;

//     this._step = sampleRate / this._targetSampleRate;
//     this._pos = 0;

//     this._samplesPerChunk = Math.max(1, Math.floor((this._targetSampleRate * this._chunkMs) / 1000));
//     this._chunk = new Int16Array(this._samplesPerChunk);
//     this._chunkIndex = 0;
//   }

//   process(inputs) {
//     const input = inputs[0];
//     if (!input || input.length === 0) return true;

//     const channel = input[0];
//     if (!channel) return true;

//     // Downsample to target sample rate by stepping through the input buffer.
//     while (this._pos < channel.length) {
//       const s = channel[Math.floor(this._pos)] || 0;
//       this._pos += this._step;

//       // float [-1,1] -> int16 LE
//       const clamped = Math.max(-1, Math.min(1, s));
//       const v = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
//       this._chunk[this._chunkIndex++] = v;

//       if (this._chunkIndex >= this._chunk.length) {
//         // Transfer the buffer for zero-copy postMessage.
//         this.port.postMessage(
//           { buffer: this._chunk.buffer },
//           [this._chunk.buffer]
//         );

//         // Re-create after transfer.
//         this._chunk = new Int16Array(this._samplesPerChunk);
//         this._chunkIndex = 0;
//       }
//     }

//     // Keep fractional position for continuity across render quanta.
//     this._pos -= channel.length;
//     return true;
//   }
// }

// registerProcessor("pcm16-processor", Pcm16Processor);

