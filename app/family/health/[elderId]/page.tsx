'use client';

import { useState, use } from 'react';
import {
  Pill,
  CalendarDays,
  FileText,
  UtensilsCrossed,
  Plus,
  Check,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { healthApi, useHealthData } from '@/lib/health-client';

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  timeSlots: string[];
  instructions: string | null;
  isActive: boolean;
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

type Section = 'medications' | 'appointments' | 'notes' | 'food';

export default function FamilyHealthPage({
  params,
}: {
  params: Promise<{ elderId: string }>;
}) {
  const { elderId } = use(params);
  const qs = `?elderUserId=${elderId}`;

  const meds = useHealthData<Medication[]>(`/medications${qs}`);
  const appts = useHealthData<Appointment[]>(`/appointments${qs}`);
  const notes = useHealthData<HealthNote[]>(`/notes${qs}`);
  const food = useHealthData<FoodRequest[]>(`/food-requests${qs}`);

  const [activeForm, setActiveForm] = useState<Section | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  // Med form
  const [medForm, setMedForm] = useState({ name: '', dosage: '', frequency: 'Daily', timeSlots: '08:00', instructions: '', prescribingDoctor: '' });

  // Appt form
  const [apptForm, setApptForm] = useState({ doctorName: '', hospital: '', specialty: '', datetime: '', notes: '' });

  // Note form
  const [noteContent, setNoteContent] = useState('');

  async function addMedication(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await healthApi.post('/medications', {
        elderUserId: elderId,
        name: medForm.name,
        dosage: medForm.dosage,
        frequency: medForm.frequency,
        timeSlots: medForm.timeSlots.split(',').map((s) => s.trim()),
        instructions: medForm.instructions || undefined,
        prescribingDoctor: medForm.prescribingDoctor || undefined,
      });
      setMedForm({ name: '', dosage: '', frequency: 'Daily', timeSlots: '08:00', instructions: '', prescribingDoctor: '' });
      setActiveForm(null);
      meds.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add medication.');
    } finally {
      setBusy(false);
    }
  }

  async function addAppointment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await healthApi.post('/appointments', {
        elderUserId: elderId,
        doctorName: apptForm.doctorName,
        hospital: apptForm.hospital || undefined,
        specialty: apptForm.specialty || undefined,
        datetime: new Date(apptForm.datetime).toISOString(),
        notes: apptForm.notes || undefined,
      });
      setApptForm({ doctorName: '', hospital: '', specialty: '', datetime: '', notes: '' });
      setActiveForm(null);
      appts.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add appointment.');
    } finally {
      setBusy(false);
    }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await healthApi.post('/notes', { elderUserId: elderId, content: noteContent });
      setNoteContent('');
      setActiveForm(null);
      notes.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add note.');
    } finally {
      setBusy(false);
    }
  }

  async function fulfillFood(id: string) {
    try {
      await healthApi.patch(`/food-requests/${id}`, { status: 'fulfilled' });
      food.reload();
    } catch { /* ignore */ }
  }

  async function toggleMed(id: string, isActive: boolean) {
    try {
      await healthApi.patch(`/medications/${id}`, { isActive: !isActive });
      meds.reload();
    } catch { /* ignore */ }
  }

  async function cancelAppt(id: string) {
    try {
      await healthApi.del(`/appointments/${id}`);
      appts.reload();
    } catch { /* ignore */ }
  }

  return (
    <div>
      <Link href="/family" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to family
      </Link>

      <h1 className="text-2xl font-bold text-text">Health management</h1>
      <p className="mt-1 text-text-secondary">Manage medicines, appointments, and notes for your elder.</p>

      {/* Medications */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-text">
            <Pill className="h-5 w-5 text-primary-600" /> Medications
          </h2>
          <Button size="sm" onClick={() => setActiveForm(activeForm === 'medications' ? null : 'medications')}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {activeForm === 'medications' && (
          <Card className="mt-3">
            <CardContent className="pt-6">
              <form onSubmit={addMedication} className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {([['name', 'Medicine name', 'Amlodipine'], ['dosage', 'Dosage', '5mg']] as const).map(([key, label, ph]) => (
                    <div key={key} className="flex flex-col gap-1">
                      <Label htmlFor={key}>{label}</Label>
                      <Input id={key} value={medForm[key]} onChange={(e) => setMedForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={ph} />
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="frequency">Frequency</Label>
                    <Input id="frequency" value={medForm.frequency} onChange={(e) => setMedForm((f) => ({ ...f, frequency: e.target.value }))} placeholder="Daily" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="timeSlots">Times (comma-separated, 24h)</Label>
                    <Input id="timeSlots" value={medForm.timeSlots} onChange={(e) => setMedForm((f) => ({ ...f, timeSlots: e.target.value }))} placeholder="08:00, 20:00" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="instructions">Instructions (optional)</Label>
                    <Input id="instructions" value={medForm.instructions} onChange={(e) => setMedForm((f) => ({ ...f, instructions: e.target.value }))} placeholder="After meals" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="prescribingDoctor">Prescribing doctor (optional)</Label>
                    <Input id="prescribingDoctor" value={medForm.prescribingDoctor} onChange={(e) => setMedForm((f) => ({ ...f, prescribingDoctor: e.target.value }))} placeholder="Dr. Sharma" />
                  </div>
                </div>
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !medForm.name || !medForm.dosage}>
                  {busy ? 'Adding…' : 'Add medication'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {meds.loading ? (
          <p className="mt-3 text-text-secondary">Loading…</p>
        ) : meds.error ? (
          <Card className="mt-3"><CardContent className="py-6 text-center text-danger-600">{meds.error}</CardContent></Card>
        ) : (meds.data?.length ?? 0) === 0 ? (
          <Card className="mt-3"><CardContent className="py-8 text-center text-text-secondary">No medications added yet.</CardContent></Card>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {meds.data?.map((m) => (
              <Card key={m.id} className={m.isActive ? '' : 'opacity-60'}>
                <CardContent className="flex items-start justify-between gap-3 pt-6">
                  <div className="min-w-0">
                    <p className="font-bold text-text">{m.name} — {m.dosage}</p>
                    <p className="text-sm text-text-secondary">{m.frequency} · {(m.timeSlots as string[]).join(', ')}</p>
                    {m.instructions && <p className="mt-1 text-sm text-text-secondary">{m.instructions}</p>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => toggleMed(m.id, m.isActive)}>
                    {m.isActive ? 'Pause' : 'Resume'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Appointments */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-text">
            <CalendarDays className="h-5 w-5 text-primary-600" /> Appointments
          </h2>
          <Button size="sm" onClick={() => setActiveForm(activeForm === 'appointments' ? null : 'appointments')}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {activeForm === 'appointments' && (
          <Card className="mt-3">
            <CardContent className="pt-6">
              <form onSubmit={addAppointment} className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="doctorName">Doctor name</Label>
                    <Input id="doctorName" value={apptForm.doctorName} onChange={(e) => setApptForm((f) => ({ ...f, doctorName: e.target.value }))} placeholder="Dr. Sharma" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="datetime">Date & time</Label>
                    <Input id="datetime" type="datetime-local" value={apptForm.datetime} onChange={(e) => setApptForm((f) => ({ ...f, datetime: e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="hospital">Hospital (optional)</Label>
                    <Input id="hospital" value={apptForm.hospital} onChange={(e) => setApptForm((f) => ({ ...f, hospital: e.target.value }))} placeholder="Apollo Hospital" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="specialty">Specialty (optional)</Label>
                    <Input id="specialty" value={apptForm.specialty} onChange={(e) => setApptForm((f) => ({ ...f, specialty: e.target.value }))} placeholder="Cardiology" />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="apptNotes">Notes (optional)</Label>
                  <Input id="apptNotes" value={apptForm.notes} onChange={(e) => setApptForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Bring previous reports" />
                </div>
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !apptForm.doctorName || !apptForm.datetime}>
                  {busy ? 'Adding…' : 'Add appointment'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {appts.loading ? (
          <p className="mt-3 text-text-secondary">Loading…</p>
        ) : (appts.data?.length ?? 0) === 0 ? (
          <Card className="mt-3"><CardContent className="py-8 text-center text-text-secondary">No upcoming appointments.</CardContent></Card>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {appts.data?.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex items-start justify-between gap-3 pt-6">
                  <div className="min-w-0">
                    <p className="font-bold text-text">{a.doctorName}</p>
                    <p className="text-sm text-text-secondary">
                      {a.specialty && `${a.specialty} · `}
                      {new Date(a.datetime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' at '}
                      {new Date(a.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {a.hospital && <p className="mt-1 text-sm text-text-secondary">{a.hospital}</p>}
                  </div>
                  {a.status === 'upcoming' && (
                    <Button size="sm" variant="outline" onClick={() => cancelAppt(a.id)}>
                      Cancel
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Health notes */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-text">
            <FileText className="h-5 w-5 text-primary-600" /> Health notes
          </h2>
          <Button size="sm" onClick={() => setActiveForm(activeForm === 'notes' ? null : 'notes')}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {activeForm === 'notes' && (
          <Card className="mt-3">
            <CardContent className="pt-6">
              <form onSubmit={addNote} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="noteContent">Note</Label>
                  <textarea
                    id="noteContent"
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-600"
                    rows={3}
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Blood pressure reading: 130/85. Slightly elevated, doctor said watch for a week."
                  />
                </div>
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !noteContent.trim()}>
                  {busy ? 'Saving…' : 'Save note'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {notes.loading ? (
          <p className="mt-3 text-text-secondary">Loading…</p>
        ) : (notes.data?.length ?? 0) === 0 ? (
          <Card className="mt-3"><CardContent className="py-8 text-center text-text-secondary">No health notes yet.</CardContent></Card>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {notes.data?.map((n) => (
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

      {/* Food requests */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-text">
          <UtensilsCrossed className="h-5 w-5 text-primary-600" /> Meal requests
        </h2>
        {food.loading ? (
          <p className="mt-3 text-text-secondary">Loading…</p>
        ) : (food.data?.length ?? 0) === 0 ? (
          <Card className="mt-3"><CardContent className="py-8 text-center text-text-secondary">No meal requests.</CardContent></Card>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {food.data?.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm">
                <Badge variant={f.status === 'fulfilled' ? 'success' : f.status === 'cancelled' ? 'muted' : 'accent'}>
                  {f.status}
                </Badge>
                <span className="font-semibold text-text">{f.requestType}</span>
                {f.notes && <span className="text-text-secondary">— {f.notes}</span>}
                <span className="ml-auto text-xs text-text-secondary">
                  {new Date(f.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {f.status === 'requested' && (
                  <Button size="sm" onClick={() => fulfillFood(f.id)}>
                    <Check className="h-4 w-4" /> Done
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
