'use client';

import { useEffect, useState } from 'react';
import { PlayCircle } from 'lucide-react';

interface HelpGuideVideo {
  id: string;
  title: string;
  youtubeUrl: string;
  description: string | null;
}

/** Public, unauthenticated "how to" videos shown below the register form —
 *  self-serve onboarding so a new family doesn't need to call anyone to get
 *  started. Renders nothing at all until an admin has actually added a video
 *  (no empty-state placeholder here — this sits below a sign-up form, and an
 *  empty "no guides yet" box there would just look broken). */
export function HelpGuidesSection() {
  const [videos, setVideos] = useState<HelpGuideVideo[] | null>(null);

  useEffect(() => {
    fetch('/api/v1/help-guides')
      .then((r) => r.json())
      .then((j) => { if (j.success) setVideos(j.data); })
      .catch(() => {});
  }, []);

  if (!videos || videos.length === 0) return null;

  return (
    <div className="mt-6 w-full max-w-md">
      <h2 className="text-center text-sm font-bold uppercase tracking-wide text-text-secondary">
        New here? Watch a quick guide
      </h2>
      <div className="mt-3 flex flex-col gap-2">
        {videos.map((v) => {
          const videoId = v.youtubeUrl.match(/(?:v=|youtu\.be\/)([\w-]{6,})/)?.[1];
          return (
            <a
              key={v.id}
              href={v.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-primary-50"
            >
              {videoId ? (
                <img
                  src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                  alt=""
                  className="h-12 w-20 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                  <PlayCircle className="h-6 w-6 text-primary-600" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-bold text-text">{v.title}</p>
                {v.description && <p className="truncate text-sm text-text-secondary">{v.description}</p>}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
