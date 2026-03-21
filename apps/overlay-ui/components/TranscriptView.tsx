export default function TranscriptView({
  transcript
}: {
  transcript: string;
}) {
  return (
    <div className="p-4 border border-gray-700 rounded">
      <h2 className="font-bold mb-2">Transcript</h2>
      <p>{transcript}</p>
    </div>
  );
}