import { Send, Video } from 'lucide-react';
import { MockFrame } from '../showcase-shell';

export function ChatMock({
  channelName,
  messages,
  hasVideo,
}: {
  channelName: string;
  messages: { from: string; text: string; self?: boolean }[];
  hasVideo?: boolean;
}) {
  return (
    <MockFrame className="p-0">
      <div className="flex items-center justify-between border-b border-border p-5">
        <p className="font-bold text-text">{channelName}</p>
        {hasVideo && (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-primary-600">
            <Video className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3 p-5">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.self ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                m.self ? 'bg-primary-600 text-white' : 'bg-primary-50 text-text'
              }`}
            >
              {!m.self && <p className="mb-0.5 text-xs font-bold text-primary-600">{m.from}</p>}
              <p className="text-sm">{m.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 border-t border-border p-4">
        <div className="flex-1 rounded-full border border-border bg-bg px-4 py-2.5 text-sm text-text-secondary">
          Type a message...
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white">
          <Send className="h-4 w-4" />
        </span>
      </div>
    </MockFrame>
  );
}
