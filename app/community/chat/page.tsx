'use client';

import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  sender: { id: string; name: string };
}
interface Me { memberships: { role: string }[] }

export default function CommunityChatPage() {
  const { data, loading, error, reload, setData } = useCommunityData<Message[]>('/community/chat');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => setMyId(j?.data?.id ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [data]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const msg = await communityApi.post<Message>('/community/chat', { body: text });
      setData((prev) => [...(prev ?? []), msg]);
      setText('');
    } catch {
      reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <CommunityPageFrame
      title="Community Buzz"
      subtitle="Chat with your neighbours."
      loading={loading}
      error={error}
    >
      <Card className="flex h-[60vh] flex-col overflow-hidden">
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {(data?.length ?? 0) === 0 && (
            <p className="py-8 text-center text-text-secondary">
              No messages yet — say hello to your neighbours.
            </p>
          )}
          {data?.map((m) => {
            const mine = m.senderId === myId;
            return (
              <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[75%] rounded-2xl px-4 py-2.5',
                    mine ? 'bg-primary-600 text-white' : 'bg-primary-50 text-text',
                  )}
                >
                  {!mine && (
                    <p className="mb-0.5 text-xs font-bold text-primary-600">{m.sender.name}</p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={send} className="flex items-center gap-3 border-t border-border p-4">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            className="min-h-tap flex-1 rounded-full border border-border bg-bg px-4 py-2.5 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </Card>
    </CommunityPageFrame>
  );
}
