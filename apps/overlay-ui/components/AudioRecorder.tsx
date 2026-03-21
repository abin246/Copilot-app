"use client";

import { useState } from "react";
import { useAudioStream } from "@/hooks/useAudioStream";
import WaveformVisualizer from "./WaveformVisualizer";

export default function AudioRecorder({
  onChunk
}: {
  onChunk: (blob: Blob) => void;
}) {
  const { start, stop, volume } = useAudioStream(onChunk);
  const [active, setActive] = useState(false);

  async function handleStart() {
    await start();
    setActive(true);
  }

  function handleStop() {
    stop();
    setActive(false);
  }

  return (
    <div className="space-y-3">

      <WaveformVisualizer volume={volume} />

      {!active ? (
        <button
          onClick={handleStart}
          className="bg-green-600 px-4 py-2 rounded"
        >
          Start Listening
        </button>
      ) : (
        <button
          onClick={handleStop}
          className="bg-red-600 px-4 py-2 rounded"
        >
          Stop
        </button>
      )}
    </div>
  );
}