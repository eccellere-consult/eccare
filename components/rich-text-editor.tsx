'use client';

import { useRef, useEffect } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon, Heading2 } from 'lucide-react';

/** A deliberately lightweight WYSIWYG editor — contentEditable +
 *  document.execCommand, not a third-party editor library (TipTap/Slate/etc.).
 *  execCommand is a long-deprecated browser API, but it's still supported
 *  everywhere that matters here (Chrome/Firefox/Safari) — pulling in a full
 *  ProseMirror-based dependency for one admin-only newsletter composer wasn't
 *  worth the bundle weight and new dependency surface. Covers what a
 *  newsletter actually needs: bold/italic/underline, headings, lists, links. */
export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Only sync external value -> DOM on first mount (or an external reset, e.g.
  // switching which newsletter is being edited) — syncing on every keystroke
  // would fight the browser's own cursor position.
  useEffect(() => {
    if (ref.current && (isFirstRender.current || ref.current.innerHTML !== value)) {
      if (document.activeElement !== ref.current) ref.current.innerHTML = value;
    }
    isFirstRender.current = false;
  }, [value]);

  function exec(command: string, arg?: string) {
    document.execCommand(command, false, arg);
    ref.current?.focus();
    onChange(ref.current?.innerHTML ?? '');
  }

  function insertLink() {
    const url = window.prompt('Link URL:');
    if (url) exec('createLink', url);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex flex-wrap gap-1 border-b border-border bg-primary-50 p-2">
        <ToolbarButton icon={Bold} label="Bold" onClick={() => exec('bold')} />
        <ToolbarButton icon={Italic} label="Italic" onClick={() => exec('italic')} />
        <ToolbarButton icon={Underline} label="Underline" onClick={() => exec('underline')} />
        <ToolbarButton icon={Heading2} label="Heading" onClick={() => exec('formatBlock', '<h2>')} />
        <ToolbarButton icon={List} label="Bulleted list" onClick={() => exec('insertUnorderedList')} />
        <ToolbarButton icon={ListOrdered} label="Numbered list" onClick={() => exec('insertOrderedList')} />
        <ToolbarButton icon={LinkIcon} label="Link" onClick={insertLink} />
      </div>
      <div
        ref={ref}
        contentEditable
        onInput={() => onChange(ref.current?.innerHTML ?? '')}
        className="prose prose-sm min-h-[200px] max-w-none px-4 py-3 text-text focus:outline-none [&_h2]:text-lg [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary-600 [&_a]:underline"
        suppressContentEditableWarning
      />
    </div>
  );
}

function ToolbarButton({ icon: Icon, label, onClick }: { icon: typeof Bold; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-primary-900 hover:bg-primary-100"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
