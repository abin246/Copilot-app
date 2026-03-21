"use client";

import { useEffect, useRef, useState } from "react";

export function useAudioStream(onChunk: (blob: Blob) => void) {
  const [volume, setVolume] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  // const workletRef = useRef<AudioWorkletNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const pendingPcmRef = useRef<Int16Array>(new Int16Array(0));

  async function start() {
    // Clean up any previous run (e.g., user clicked start twice).
    stop();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const audioCtx = new AudioContext({ latencyHint: "interactive" });
    audioCtxRef.current = audioCtx;

    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    const detect = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setVolume(avg);
      rafRef.current = requestAnimationFrame(detect);
    };
    detect();

    // Capture PCM samples and send 16 kHz mono 16-bit little-endian chunks.
    // MediaRecorder (webm/opus) bytes do not match the backend's raw PCM expectation.
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;
    // Prefer AudioWorklet (low-latency, not deprecated). Fall back to ScriptProcessorNode.
    const targetSampleRate = 16000;
    const samplesPerChunk = Math.floor(targetSampleRate * 0.45);

    processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    const resampled =
      audioCtx.sampleRate === targetSampleRate
        ? input
        : resampleLinear(input, audioCtx.sampleRate, targetSampleRate);

     const pcm16 = floatToInt16(resampled);

    // Append to pending buffer.
    const pending = pendingPcmRef.current;
    const merged = new Int16Array(pending.length + pcm16.length);
    merged.set(pending, 0);
    merged.set(pcm16, pending.length);
    pendingPcmRef.current = merged;

    // Emit fixed-size chunks.
    while (pendingPcmRef.current.length >= samplesPerChunk) {
      const out = pendingPcmRef.current.subarray(0, samplesPerChunk);
      pendingPcmRef.current = pendingPcmRef.current.subarray(samplesPerChunk);
      // BlobPart typing is stricter around SharedArrayBuffer; copy into a Uint8Array to be safe.
      const bytes = new Uint8Array(out.byteLength);
      bytes.set(new Uint8Array(out.buffer, out.byteOffset, out.byteLength));
      onChunk(new Blob([bytes], { type: "application/octet-stream" }));
    }
  };

  // Keep the processor alive by connecting it to the destination.
  source.connect(processor);
  processor.connect(audioCtx.destination);

    // if (audioCtx.audioWorklet?.addModule) {
    //   await audioCtx.audioWorklet.addModule("/pcm16-worklet.js");

    //   const node = new AudioWorkletNode(audioCtx, "pcm16-processor", {
    //     numberOfInputs: 1,
    //     numberOfOutputs: 1,
    //     outputChannelCount: [1],
    //     processorOptions: {
    //       targetSampleRate,
    //       chunkMs: 800
    //     }
    //   });

    //   node.port.onmessage = (event) => {
    //     const buffer = event.data?.buffer as ArrayBuffer | undefined;
    //     if (!buffer) return;
    //     onChunk(new Blob([buffer], { type: "application/octet-stream" }));
    //   };

    //   workletRef.current = node;

    //   // Keep the worklet alive while muting output.
    //   const mute = audioCtx.createGain();
    //   mute.gain.value = 0;

    //   source.connect(node);
    //   node.connect(mute);
    //   mute.connect(audioCtx.destination);
    // } else {
    //   // Fallback: ScriptProcessorNode (deprecated, but available in older browsers).
    //   const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    //   processorRef.current = processor;

      // const samplesPerChunk = Math.floor(targetSampleRate * 0.8); // ~800ms

      // processor.onaudioprocess = (e) => {
      //   const input = e.inputBuffer.getChannelData(0);
      //   const resampled =
      //     audioCtx.sampleRate === targetSampleRate
      //       ? input
      //       : resampleLinear(input, audioCtx.sampleRate, targetSampleRate);

      //   const pcm16 = floatToInt16(resampled);

        // Append to pending buffer.
        // const pending = pendingPcmRef.current;
        // const merged = new Int16Array(pending.length + pcm16.length);
        // merged.set(pending, 0);
        // merged.set(pcm16, pending.length);
        // pendingPcmRef.current = merged;

        // Emit fixed-size chunks.
      //   while (pendingPcmRef.current.length >= samplesPerChunk) {
      //     const out = pendingPcmRef.current.subarray(0, samplesPerChunk);
      //     pendingPcmRef.current = pendingPcmRef.current.subarray(samplesPerChunk);
      //     const bytes = new Uint8Array(out.byteLength);
      //     bytes.set(new Uint8Array(out.buffer, out.byteOffset, out.byteLength));
      //     onChunk(new Blob([bytes], { type: "application/octet-stream" }));
      //   }
      // };

  //     source.connect(processor);
  //     processor.connect(audioCtx.destination);
  //   }
   }

  function stop() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // workletRef.current?.disconnect();
    // workletRef.current = null;

    processorRef.current?.disconnect();
    processorRef.current = null;

    pendingPcmRef.current = new Int16Array(0);

    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    streamRef.current = null;

    const ctx = audioCtxRef.current;
    if (ctx) {
      void ctx.close();
    }
    audioCtxRef.current = null;
  }

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { start, stop, volume };
}

function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function resampleLinear(input: Float32Array, fromSampleRate: number, toSampleRate: number): Float32Array {
  const ratio = fromSampleRate / toSampleRate;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);

  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;

    const a = input[idx] ?? 0;
    const b = input[idx + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }

  return out;
}
