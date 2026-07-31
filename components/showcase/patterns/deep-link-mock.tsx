import { ExternalLink } from 'lucide-react';
import { MockFrame } from '../showcase-shell';

export function DeepLinkMock({
  partners,
}: {
  partners: { name: string; blurb: string; color: string }[];
}) {
  return (
    <MockFrame>
      <div className="grid gap-4 sm:grid-cols-2">
        {partners.map((p) => (
          <div key={p.name} className="flex items-center gap-4 rounded-2xl border border-border bg-bg p-5">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-black text-white"
              style={{ backgroundColor: p.color }}
            >
              {p.name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-bold text-text">{p.name}</p>
              <p className="text-sm text-text-secondary">{p.blurb}</p>
            </div>
            <ExternalLink className="h-4 w-4 shrink-0 text-text-secondary" />
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-text-secondary">
        Opens the partner's app with your details pre-filled — a smart referral, not a full integration.
      </p>
    </MockFrame>
  );
}
