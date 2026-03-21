"use client";

export default function WaveformVisualizer({ volume }: { volume: number }) {
  const bars = new Array(20).fill(0);

  return (
    <div className="flex gap-1 h-10 items-end">
      {bars.map((_, i) => (
        <div
          key={i}
          className="w-1 bg-green-400"
          style={{
            height: `${Math.max(4, volume / 2 + Math.random() * 10)}px`
          }}
        />
      ))}
    </div>
  );
}