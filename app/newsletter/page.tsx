'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface NewsletterSummary {
  id: string;
  title: string;
  excerpt: string | null;
  publishedAt: string;
}

/** Public archive — genuinely unauthenticated (see GET /api/v1/newsletters),
 *  browsable by anyone. A logged-in visitor already gets full portal chrome
 *  from the server layout (NewsletterLayout wraps them in AppShell) — this
 *  page's own logo+"Sign in" header is only for the anonymous case, so it
 *  checks auth itself (page components don't receive layout's server-side
 *  user as a prop) and skips its header when a session already exists,
 *  rather than stacking a redundant "Sign in" link on top of the real nav. */
export default function NewsletterArchivePage() {
  const [newsletters, setNewsletters] = useState<NewsletterSummary[] | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    fetch('/api/v1/newsletters')
      .then((r) => r.json())
      .then((j) => { if (j.success) setNewsletters(j.data); })
      .catch(() => {});
    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => setLoggedIn(Boolean(j.success)))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {!loggedIn && (
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
            <Link href="/" className="text-xl font-bold text-primary-600">
              EC <span className="font-normal text-text-secondary">— Just Easy.</span>
            </Link>
            <Link href="/login" className="text-sm font-semibold text-text-secondary hover:text-primary-600">
              Sign in
            </Link>
          </div>
        </header>
      )}

      <main className="mx-auto max-w-3xl px-6 py-12">
        {/* "/" unconditionally redirects to /login (see app/page.tsx) — for an
            already-logged-in visitor that reads as being logged out, even
            though the session itself is untouched. Newsletter is reachable
            as a tile from the Community hub, so send a logged-in visitor
            back there, matching every other Community tile's back-link
            pattern; an anonymous visitor has nowhere else to go, so "/" (->
            /login) stays correct for them. */}
        <Link
          href={loggedIn ? '/community' : '/'}
          className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600"
        >
          <ArrowLeft className="h-4 w-4" /> {loggedIn ? 'Back to Community' : 'Back to EC'}
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-text">Newsletter</h1>
        <p className="mt-2 text-text-secondary">Community updates, elder care tips, and announcements from the EC team.</p>

        <div className="mt-8 flex flex-col gap-4">
          {newsletters?.map((n) => (
            <Link key={n.id} href={`/newsletter/${n.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-start gap-4 pt-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
                    <Mail className="h-5 w-5 text-primary-600" />
                  </span>
                  <div>
                    <p className="text-xs text-text-secondary">{new Date(n.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    <p className="mt-0.5 font-bold text-text">{n.title}</p>
                    {n.excerpt && <p className="mt-1 text-sm text-text-secondary">{n.excerpt}</p>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {newsletters && newsletters.length === 0 && (
            <Card><CardContent className="py-12 text-center text-text-secondary">No newsletters published yet — check back soon.</CardContent></Card>
          )}
        </div>
      </main>
    </div>
  );
}
