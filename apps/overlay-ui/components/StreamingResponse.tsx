"use client";

import { useEffect, useState } from "react";

export default function StreamingResponse({
  text
}: {
  text: string;
}) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    if (text.length > display.length) {
      const timeout = setTimeout(() => {
        setDisplay(text.slice(0, display.length + 1));
      }, 10);

      return () => clearTimeout(timeout);
    }
  }, [text, display]);

  return (
    <div className="p-4 border rounded border-gray-700">
      <h2 className="font-bold mb-2">AI Copilot</h2>
      <p className="whitespace-pre-wrap">{display}</p>
    </div>
  );
}