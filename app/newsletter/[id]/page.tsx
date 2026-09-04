'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Share2 } from 'lucide-react';

interface NewsletterArticle {
  id: string;
  title: string;
  bodyHtml: string;
  excerpt: string | null;
  publishedAt: string;
}

export default function NewsletterArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [article, setArticle] = useState<NewsletterArticle | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/newsletters/${id}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setArticle(j.data); else setNotFound(true); })
      .catch(() => setNotFound(true));
  }, [id]);

  async function share() {
    if (!article) return;
    const url = window.location.href;
    // Native share sheet where available (mobile browsers, installed PWA);
    // falls back to copying the link on desktop, where navigator.share is
    // usually unsupported.
    if (navigator.share) {
      try {
        await navigator.share({ title: article.title, text: article.excerpt ?? undefined, url });
      } catch {
        /* user cancelled the share sheet — not an error */
      }
    } else {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  }

  if (notFound) return <div className="p-8 text-center text-text-secondary">This newsletter isn&rsquo;t available.</div>;
  if (!article) return <div className="p-8 text-center text-text-secondary">Loading…</div>;

  return (
    <div className="min-h-screen bg-background">
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

      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/newsletter" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600">
          <ArrowLeft className="h-4 w-4" /> Newsletter
        </Link>

        <p className="mt-4 text-sm text-text-secondary">
          {new Date(article.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h1 className="text-3xl font-bold text-text">{article.title}</h1>
          <button
            type="button"
            onClick={share}
            aria-label="Share this article"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-text-secondary hover:bg-primary-50 hover:text-primary-600"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>
        {shared && <p className="mt-1 text-xs text-success-600">Link copied to clipboard</p>}

        <div
          className="prose prose-sm mt-8 max-w-none text-text [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary-600 [&_a]:underline [&_p]:leading-relaxed [&_p]:text-text-secondary"
          dangerouslySetInnerHTML={{ __html: article.bodyHtml }}
        />
      </main>
    </div>
  );
}
