'use client';

import { useState, useEffect } from 'react';
import {
  Pill,
  CalendarDays,
  FileText,
  UtensilsCrossed,
  Check,
  FileImage,
  Eye,
  Phone,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { healthApi, useHealthData } from '@/lib/health-client';
import { getSlotForDate, formatIstTime, SLOT_META, SLOT_ORDER, todayIST, type MedicineSlot } from '@/lib/medicine-slots';

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  timeSlots: string[];
  instructions: string | null;
}

interface Reminder {
  id: string;
  scheduledAt: string;
  status: string;
  medication: { name: string; dosage: string; instructions: string | null };
}

interface Appointment {
  id: string;
  doctorName: string;
  hospital: string | null;
  specialty: string | null;
  datetime: string;
  notes: string | null;
  status: string;
}

interface HealthNote {
  id: string;
  content: string;
  createdAt: string;
  createdBy: { name: string; role: string };
}

interface FoodRequest {
  id: string;
  requestType: string;
  notes: string | null;
  status: string;
  createdAt: string;
  handler: { name: string } | null;
}

interface Prescription {
  id: string;
  fileName: string;
  filePath: string;
  doctorName: string | null;
  hospitalName: string | null;
  prescriptionDate: string | null;
  createdAt: string;
  medications: { name: string; dosage: string }[];
}

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

const SLOT_ICON: Record<MedicineSlot, typeof Sunrise> = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Sunset,
  night: Moon,
};

const SLOT_STYLE: Record<MedicineSlot, { card: string; iconWrap: string; icon: string; heading: string; sub: string; itemBorder: string }> = {
  morning: {
    card: 'border-accent-100 bg-accent-50',
    iconWrap: 'bg-white',
    icon: 'text-accent-600',
    heading: 'text-accent-900',
    sub: 'text-accent-600',
    itemBorder: 'border-accent-100',
  },
  afternoon: {
    card: 'border-primary-100 bg-primary-50',
    iconWrap: 'bg-white',
    icon: 'text-primary-600',
    heading: 'text-primary-900',
    sub: 'text-primary-600',
    itemBorder: 'border-primary-100',
  },
  evening: {
    card: 'border-accent-100 bg-accent-100',
    iconWrap: 'bg-white/70',
    icon: 'text-accent-900',
    heading: 'text-accent-900',
    sub: 'text-accent-900/70',
    itemBorder: 'border-white/60',
  },
  night: {
    card: 'border-primary-900 bg-primary-900',
    iconWrap: 'bg-white/10',
    icon: 'text-white',
    heading: 'text-white',
    sub: 'text-primary-100',
    itemBorder: 'border-white/15',
  },
};

export default function ElderHealthPage() {
  const today = todayIST();

  const meds = useHealthData<Medication[]>('/medications');
  const reminders = useHealthData<Reminder[]>(`/reminders?date=${today}`);
  const appts = useHealthData<Appointment[]>('/appointments');
  const notes = useHealthData<HealthNote[]>('/notes');
  const food = useHealthData<FoodRequest[]>('/food-requests');
  const prescriptions = useHealthData<Prescription[]>('/prescriptions');

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  useEffect(() => {
    fetch('/api/v1/emergency/contacts', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.success) setContacts(j.data); })
      .catch(() => {});
  }, []);

  const [confirmingSlot, setConfirmingSlot] = useState<MedicineSlot | null>(null);
  const [slotError, setSlotError] = useState('');
  const [foodBusy, setFoodBusy] = useState(false);

  async function confirmSlot(slot: MedicineSlot, reminderIds: string[]) {
    setConfirmingSlot(slot);
    setSlotError('');
    try {
      await healthApi.post('/reminders/confirm-batch', { reminderIds });
      reminders.reload();
    } catch (err) {
      setSlotError(err instanceof Error ? err.message : 'Could not confirm. Please try again.');
    } finally {
      setConfirmingSlot(null);
    }
  }

  async function requestMeal(type: string) {
    setFoodBusy(true);
    try {
      await healthApi.post('/food-requests', { requestType: type });
      food.reload();
    } finally {
      setFoodBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">My health</h1>
      <p className="mt-1 text-text-secondary">Your medications, appointments, and care notes.</p>

      {/* Today's medicine box — one compartment per time of day */}
      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-text">
          <Pill className="h-5 w-5 text-primary-600" />
          Today&rsquo;s medicines
        </h2>

        {reminders.loading ? (
          <p className="mt-3 text-text-secondary">Loading…</p>
        ) : reminders.error ? (
          <Card className="mt-3"><CardContent className="py-6 text-center text-danger-600">{reminders.error}</CardContent></Card>
        ) : (reminders.data?.length ?? 0) === 0 ? (
          <Card className="mt-3"><CardContent className="py-8 text-center text-text-secondary">No medicines scheduled for today.</CardContent></Card>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {SLOT_ORDER.map((slot) => {
              const items = (reminders.data ?? []).filter((r) => getSlotForDate(new Date(r.scheduledAt)) === slot);
              if (items.length === 0) return null;

              const pendingIds = items.filter((r) => r.status === 'pending').map((r) => r.id);
              const allConfirmed = pendingIds.length === 0;
              const style = SLOT_STYLE[slot];
              const Icon = SLOT_ICON[slot];

              return (
                <div key={slot} className={`rounded-2xl border-2 p-4 ${style.card}`}>
                  <div className="flex items-center gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${style.iconWrap}`}>
                      <Icon className={`h-6 w-6 ${style.icon}`} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-lg font-extrabold ${style.heading}`}>{SLOT_META[slot].label}</p>
                      <p className={`text-xs ${style.sub}`}>{SLOT_META[slot].range}</p>
                    </div>
                    <Badge variant="muted" className="shrink-0 bg-white/80 text-text">
                      {items.length} medicine{items.length === 1 ? '' : 's'}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-col gap-2">
                    {items.map((r) => (
                      <div key={r.id} className={`flex items-center gap-3 rounded-xl border bg-white/60 px-3 py-2 ${style.itemBorder}`}>
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${r.status === 'taken' ? 'bg-success-50' : 'bg-white'}`}>
                          {r.status === 'taken' && <Check className="h-4 w-4 text-success-600" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-text">{r.medication.name} — {r.medication.dosage}</p>
                          {r.medication.instructions && (
                            <p className="truncate text-xs text-text-secondary">{r.medication.instructions}</p>
                          )}
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-text-secondary">
                          By {formatIstTime(new Date(r.scheduledAt))}
                        </span>
                      </div>
                    ))}
                  </div>

                  {allConfirmed ? (
                    <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-success-50 py-2.5 text-sm font-bold text-success-600">
                      <Check className="h-4 w-4" /> All confirmed for {SLOT_META[slot].label.toLowerCase()}
                    </div>
                  ) : (
                    <Button
                      className="mt-3 w-full"
                      disabled={confirmingSlot === slot}
                      onClick={() => confirmSlot(slot, pendingIds)}
                    >
                      {confirmingSlot === slot ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Confirming…
                        </>
                      ) : (
                        `Confirm ${pendingIds.length} taken`
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {slotError && <p className="mt-2 text-sm text-danger-600">{slotError}</p>}
        {(meds.data?.length ?? 0) > 0 && (reminders.data?.length ?? 0) === 0 && !reminders.loading && (
          <p className="mt-2 text-sm text-text-secondary">
            You have {meds.data?.length} active medicine{meds.data?.length === 1 ? '' : 's'}, but no reminders were generated for today.
            Your caregiver can set those up.
          </p>
        )}
      </section>

      {/* Upcoming appointments */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-text">
          <CalendarDays className="h-5 w-5 text-primary-600" />
          Upcoming appointments
        </h2>
        {appts.loading ? (
          <p className="mt-3 text-text-secondary">Loading…</p>
        ) : (appts.data?.length ?? 0) === 0 ? (
          <Card className="mt-3"><CardContent className="py-8 text-center text-text-secondary">No upcoming appointments.</CardContent></Card>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {appts.data?.map((a) => (
              <Card key={a.id}>
                <CardContent className="pt-6">
                  <p className="font-bold text-text">{a.doctorName}</p>
                  <p className="text-sm text-text-secondary">
                    {a.specialty && `${a.specialty} · `}
                    {new Date(a.datetime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' at '}
                    {new Date(a.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {a.hospital && <p className="mt-1 text-sm text-text-secondary">{a.hospital}</p>}
                  {a.notes && <p className="mt-2 text-sm text-text-secondary">{a.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Health notes */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-text">
          <FileText className="h-5 w-5 text-primary-600" />
          Health notes
        </h2>
        {notes.loading ? (
          <p className="mt-3 text-text-secondary">Loading…</p>
        ) : (notes.data?.length ?? 0) === 0 ? (
          <Card className="mt-3"><CardContent className="py-8 text-center text-text-secondary">No health notes yet.</CardContent></Card>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {notes.data?.slice(0, 10).map((n) => (
              <Card key={n.id}>
                <CardContent className="pt-6">
                  <p className="text-text">{n.content}</p>
                  <p className="mt-2 text-xs text-text-secondary">
                    By {n.createdBy.name} · {new Date(n.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Meal assistance */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-text">
          <UtensilsCrossed className="h-5 w-5 text-primary-600" />
          Meal help
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Need help with a meal? Tap below — your family will be notified.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
            <Button key={type} variant="outline" disabled={foodBusy} onClick={() => requestMeal(type)}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Button>
          ))}
        </div>
        {(food.data?.length ?? 0) > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {food.data?.slice(0, 5).map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm">
                <Badge variant={f.status === 'fulfilled' ? 'success' : f.status === 'cancelled' ? 'muted' : 'accent'}>
                  {f.status}
                </Badge>
                <span className="text-text">{f.requestType}</span>
                {f.handler && <span className="text-text-secondary">· handled by {f.handler.name}</span>}
                <span className="ml-auto text-xs text-text-secondary">
                  {new Date(f.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* My prescriptions */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-text">
          <FileImage className="h-5 w-5 text-primary-600" />
          My prescriptions
        </h2>
        {prescriptions.loading ? (
          <p className="mt-3 text-text-secondary">Loading…</p>
        ) : (prescriptions.data?.length ?? 0) === 0 ? (
          <Card className="mt-3"><CardContent className="py-8 text-center text-text-secondary">No prescriptions uploaded yet. Your caregiver can upload them.</CardContent></Card>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {prescriptions.data?.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex items-start justify-between gap-3 pt-6">
                  <div className="min-w-0">
                    <p className="font-bold text-text">
                      {p.doctorName ?? p.fileName}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {p.hospitalName && `${p.hospitalName} · `}
                      {p.prescriptionDate
                        ? new Date(p.prescriptionDate).toLocaleDateString()
                        : new Date(p.createdAt).toLocaleDateString()}
                    </p>
                    {p.medications.length > 0 && (
                      <p className="mt-1 text-xs text-text-secondary">
                        {p.medications.map((m) => `${m.name} ${m.dosage}`).join(', ')}
                      </p>
                    )}
                  </div>
                  <a
                    href={p.filePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-primary-600 hover:bg-primary-50"
                  >
                    <Eye className="h-5 w-5" />
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Emergency quick reference */}
      {contacts.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-bold text-text">
            <Phone className="h-5 w-5 text-danger-600" />
            Emergency contacts
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {contacts.map((c) => (
              <a
                key={c.id}
                href={`tel:${c.phone}`}
                className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 transition-colors hover:bg-primary-50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-50">
                  <Phone className="h-5 w-5 text-danger-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-text">{c.name}</p>
                  <p className="text-sm text-text-secondary">{c.relationship} · {c.phone}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
