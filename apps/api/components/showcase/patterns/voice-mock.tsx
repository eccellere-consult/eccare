import { Mic } from 'lucide-react';
import { MockFrame } from '../showcase-shell';

export function VoiceMock({
  prompt,
  response,
}: {
  prompt: string;
  response: string;
}) {
  return (
    <MockFrame className="flex flex-col items-center text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-600 shadow-lg shadow-accent-100">
        <Mic className="h-9 w-9 text-white" />
      </div>
      <div className="mt-6 w-full max-w-md rounded-2xl bg-primary-600 px-5 py-3 text-left text-white">
        <p className="text-xs font-bold uppercase opacity-80">You said</p>
        <p className="mt-1">{prompt}</p>
      </div>
      <div className="mt-3 w-full max-w-md rounded-2xl bg-primary-50 px-5 py-3 text-left text-text">
        <p className="text-xs font-bold uppercase text-primary-600">EC</p>
        <p className="mt-1">{response}</p>
      </div>
    </MockFrame>
  );
}
