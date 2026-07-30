import { Phone } from 'lucide-react';
import { MockFrame } from '../showcase-shell';

export function ContactListMock({
  contacts,
}: {
  contacts: { name: string; relation: string; initial: string }[];
}) {
  return (
    <MockFrame>
      <div className="flex flex-col gap-3">
        {contacts.map((c) => (
          <div
            key={c.name}
            className="flex items-center gap-4 rounded-2xl border border-border bg-bg p-4"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-lg font-bold text-primary-900">
              {c.initial}
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold text-text">{c.name}</p>
              <p className="text-sm text-text-secondary">{c.relation}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-white">
              <Phone className="h-5 w-5" />
            </div>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}
