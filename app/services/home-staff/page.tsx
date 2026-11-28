'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Phone, MessageCircle, ShieldCheck, UserCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ENGAGEMENTS, STAFF_ROLES, formatRate, staffRole, type Engagement } from '@/lib/care-staff';

interface Staff {
  id: string;
  personName: string;
  role: string;
  qualification: string | null;
  experienceYears: number | null;
  languages: string | null;
  about: string | null;
  verifiedUntil: string | null;
  rates: { unit: string; amount: number; note: string | null }[];
  provider: { businessName: string; phone: string | null; serviceArea: string | null };
}

/** WhatsApp wants the number with the country code and no "+". */
function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

/**
 * Verified home-care staff, by section: home visits (nurse, doctor), full time (home nurse,
 * caretaker, security) and part time (cook, house help). Every person here was checked by EC
 * (ID, certificates) and the rates shown are the ones EC approved.
 */
export default function HomeStaffPage() {
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [section, setSection] = useState<Engagement>('on_visit');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/services/home-staff', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setStaff(j.data.staff);
          setEnabled(j.data.enabled);
        } else setStaff([]);
      })
      .catch(() => setStaff([]));
  }, []);

  const rolesHere = STAFF_ROLES.filter((r) => r.engagement === section);
  const shown = (staff ?? []).filter((s) => staffRole(s.role)?.engagement === section && (!roleFilter || s.role === roleFilter));

  return (
    <div>
      <Link href="/services" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600">
        <ArrowLeft className="h-4 w-4" />
        Services
      </Link>

      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold text-text">
        <UserCheck className="h-6 w-6 text-primary-600" /> Home-care staff
      </h1>
      <p className="mt-1 text-text-secondary">Nurses, doctors, caretakers, security, cooks and house help. Every person here was checked by EC.</p>

      {!enabled ? (
        <Card className="mt-6">
          <CardContent className="py-12 text-center text-text-secondary">This is opening soon.</CardContent>
        </Card>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2" role="tablist" aria-label="Kind of help">
            {ENGAGEMENTS.map((e) => (
              <button
                key={e.value}
                role="tab"
                aria-selected={section === e.value}
                onClick={() => {
                  setSection(e.value);
                  setRoleFilter(null);
                }}
                className={`rounded-xl border px-3 py-3 text-left transition-colors pointer-coarse:py-4 ${
                  section === e.value ? 'border-primary-600 bg-primary-50' : 'border-border bg-surface hover:bg-primary-50'
                }`}
              >
                <span className="block font-bold text-text">{e.label}</span>
                <span className="hidden text-xs text-text-secondary sm:block">{e.hint}</span>
              </button>
            ))}
          </div>

          {rolesHere.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant={roleFilter === null ? 'primary' : 'outline'} onClick={() => setRoleFilter(null)}>
                All
              </Button>
              {rolesHere.map((r) => (
                <Button key={r.value} size="sm" variant={roleFilter === r.value ? 'primary' : 'outline'} onClick={() => setRoleFilter(r.value)}>
                  {r.label}
                </Button>
              ))}
            </div>
          )}

          {staff === null ? (
            <p className="mt-6 text-text-secondary">Loading…</p>
          ) : shown.length === 0 ? (
            <Card className="mt-6">
              <CardContent className="py-12 text-center text-text-secondary">No one listed here yet. Please check again soon.</CardContent>
            </Card>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {shown.map((s) => (
                <Card key={s.id}>
                  <CardContent className="flex h-full flex-col gap-3 pt-6">
                    <div>
                      <p className="text-lg font-bold text-text">{s.personName}</p>
                      <p className="text-sm text-text-secondary">
                        {staffRole(s.role)?.label} · {s.provider.businessName}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-success-600">
                        <ShieldCheck className="h-4 w-4" /> EC verified
                        {s.verifiedUntil ? ` until ${new Date(s.verifiedUntil).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : ''}
                      </p>
                    </div>

                    <ul className="flex flex-col gap-1">
                      {s.rates.map((r, i) => (
                        <li key={i} className="text-xl font-bold text-text">
                          {formatRate(r.amount, r.unit)}
                          {r.note && <span className="ml-2 text-sm font-normal text-text-secondary">{r.note}</span>}
                        </li>
                      ))}
                    </ul>

                    <p className="text-sm text-text-secondary">
                      {[s.qualification, s.experienceYears != null ? `${s.experienceYears} years' experience` : null, s.languages, s.provider.serviceArea]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {s.about && <p className="text-sm text-text">{s.about}</p>}

                    {s.provider.phone && (
                      <div className="mt-auto flex flex-wrap gap-2 pt-2">
                        <Button asChild className="flex-1">
                          <a href={`tel:${s.provider.phone}`}>
                            <Phone className="h-4 w-4" /> Call
                          </a>
                        </Button>
                        <Button asChild variant="outline" className="flex-1">
                          <a
                            href={`https://wa.me/${waNumber(s.provider.phone)}?text=${encodeURIComponent(
                              `Hello, I saw ${s.personName} (${staffRole(s.role)?.label ?? ''}) on EC. Is this available?`,
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageCircle className="h-4 w-4" /> WhatsApp
                          </a>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
