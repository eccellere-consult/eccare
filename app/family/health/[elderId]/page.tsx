'use client';

import { useState, useRef, use } from 'react';
import {
  Pill,
  CalendarDays,
  FileText,
  UtensilsCrossed,
  Plus,
  Check,
  Upload,
  Loader2,
  Eye,
  Trash2,
  ArrowLeft,
  X,
  Sparkles,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { HealthEssentials } from '@/components/health-essentials';
import { healthApi, useHealthData } from '@/lib/health-client';

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  timeSlots: string[];
  instructions: string | null;
  endDate: string | null;
  isActive: boolean;
}

interface Prescription {
  id: string;
  fileName: string;
  filePath: string;
  doctorName: string | null;
  hospitalName: string | null;
  prescriptionDate: string | null;
  notes: string | null;
  reviewed: boolean;
  createdAt: string;
  uploadedBy: { name: string };
  medications: { id: string; name: string; dosage: string; isActive: boolean }[];
}

interface ReviewMedication {
  key: number;
  name: string;
  dosage: string;
  frequency: string;
  timeSlots: string;
  instructions: string;
  // "" means indefinite/ongoing — left blank on purpose since most elder medication
  // has no end date; only set for short courses like antibiotics.
  durationDays: string;
}

interface ReviewAppointment {
  doctorName: string;
  hospital: string;
  specialty: string;
  datetime: string;
  notes: string;
}

interface ReviewState {
  prescriptionId: string;
  fileName: string;
  medications: ReviewMedication[];
  appointment: ReviewAppointment | null;
  includeAppointment: boolean;
  aiNotes: string | null;
  aiProvider: string | null;
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

interface MoodEntry {
  id: string;
  mood: 'great' | 'good' | 'okay' | 'low' | 'not_well';
  createdAt: string;
}

const MOOD_META: Record<MoodEntry['mood'], { emoji: string; label: string }> = {
  great: { emoji: '😊', label: 'Great' },
  good: { emoji: '🙂', label: 'Good' },
  okay: { emoji: '😐', label: 'Okay' },
  low: { emoji: '😕', label: 'Low' },
  not_well: { emoji: '😟', label: 'Not well' },
};

interface FoodRequest {
  id: string;
  requestType: string;
  notes: string | null;
  status: string;
  createdAt: string;
  handler: { name: string } | null;
}

interface FamilyMediaLinkItem {
  id: string;
  title: string;
  url: string;
  mediaType: 'video' | 'music';
  description: string | null;
}

type Section = 'medications' | 'appointments' | 'notes' | 'food' | 'media';

export default function FamilyHealthPage({
  params,
}: {
  params: Promise<{ elderId: string }>;
}) {
  const { elderId } = use(params);
  const qs = `?elderUserId=${elderId}`;

  // &all=1 — without it, GET /medications defaults to isActive-only, so a paused
  // medication would vanish from this list entirely with no way back (the
  // opacity-dimmed "Resume" state below could never actually be reached).
  const meds = useHealthData<Medication[]>(`/medications${qs}&all=1`);
  const prescriptions = useHealthData<Prescription[]>(`/prescriptions${qs}`);
  const appts = useHealthData<Appointment[]>(`/appointments${qs}`);
  const notes = useHealthData<HealthNote[]>(`/notes${qs}`);
  const food = useHealthData<FoodRequest[]>(`/food-requests${qs}`);
  const mood = useHealthData<MoodEntry[]>(`/mood${qs}`);
  const mediaLinks = useHealthData<FamilyMediaLinkItem[]>(`/media-links${qs}`);

  const [activeForm, setActiveForm] = useState<Section | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  // Prescription upload + review
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [saveSummary, setSaveSummary] = useState<{ medications: number; appointment: boolean } | null>(null);
  const reviewKeyCounter = useRef(0);
  const nextReviewKey = () => (reviewKeyCounter.current += 1);

  // Med form
  const [medForm, setMedForm] = useState({ name: '', dosage: '', frequency: 'Daily', timeSlots: '08:00', instructions: '', prescribingDoctor: '' });

  // Existing-medication edit form
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [editMedForm, setEditMedForm] = useState({ name: '', dosage: '', frequency: '', timeSlots: '', instructions: '', endDate: '' });
  const [editMedError, setEditMedError] = useState('');
  const [savingMed, setSavingMed] = useState(false);

  // Appt form
  const [apptForm, setApptForm] = useState({ doctorName: '', hospital: '', specialty: '', datetime: '', notes: '' });
  const [mediaForm, setMediaForm] = useState<{ title: string; url: string; mediaType: 'video' | 'music'; description: string }>({
    title: '',
    url: '',
    mediaType: 'video',
    description: '',
  });

  // Note form
  const [noteContent, setNoteContent] = useState('');

  async function uploadPrescription(file: File) {
    setUploading(true);
    setReview(null);
    setSaveSummary(null);
    setFormError('');
    setReviewError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('elderUserId', elderId);

      const res = await fetch('/api/v1/health/prescriptions', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const text = await res.text();
      let json: {
        success?: boolean;
        data?: {
          prescription?: { id: string; fileName: string; notes: string | null };
          extractedMedications?: {
            name: string;
            dosage: string;
            frequency: string;
            timeSlots: string[];
            instructions: string | null;
            durationDays: number | null;
          }[];
          nextVisitDate?: string | null;
          aiProvider?: string;
        };
        error?: { message: string };
      };
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`Server error (${res.status}). Please try again.`);
      }
      if (!res.ok || !json.success || !json.data?.prescription) {
        throw new Error(json?.error?.message || 'Upload failed.');
      }

      setReview({
        prescriptionId: json.data.prescription.id,
        fileName: json.data.prescription.fileName,
        medications: (json.data.extractedMedications ?? []).map((m) => ({
          key: nextReviewKey(),
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          timeSlots: m.timeSlots.join(', '),
          instructions: m.instructions ?? '',
          durationDays: m.durationDays != null ? String(m.durationDays) : '',
        })),
        appointment: json.data.nextVisitDate
          ? {
              doctorName: '',
              hospital: '',
              specialty: '',
              datetime: `${json.data.nextVisitDate}T09:00`,
              notes: 'Follow-up from prescription',
            }
          : null,
        includeAppointment: Boolean(json.data.nextVisitDate),
        aiNotes: json.data.prescription.notes,
        aiProvider: json.data.aiProvider ?? null,
      });
      prescriptions.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function updateReviewMed(key: number, field: keyof Omit<ReviewMedication, 'key'>, value: string) {
    setReview((r) => r && { ...r, medications: r.medications.map((m) => (m.key === key ? { ...m, [field]: value } : m)) });
  }

  function removeReviewMed(key: number) {
    setReview((r) => r && { ...r, medications: r.medications.filter((m) => m.key !== key) });
  }

  function addReviewMedRow() {
    setReview(
      (r) =>
        r && {
          ...r,
          medications: [
            ...r.medications,
            { key: nextReviewKey(), name: '', dosage: '', frequency: 'Daily', timeSlots: '08:00', instructions: '', durationDays: '' },
          ],
        },
    );
  }

  function updateReviewAppt(field: keyof ReviewAppointment, value: string) {
    setReview((r) => r && r.appointment && { ...r, appointment: { ...r.appointment, [field]: value } });
  }

  async function saveReview() {
    if (!review) return;
    setReviewError('');
    for (const m of review.medications) {
      if (!m.name.trim() || !m.dosage.trim() || !m.timeSlots.trim()) {
        setReviewError('Every medication needs a name, dosage, and at least one time.');
        return;
      }
    }
    if (review.includeAppointment && review.appointment && !review.appointment.doctorName.trim()) {
      setReviewError('Enter a doctor name for the appointment, or remove it.');
      return;
    }

    setSavingReview(true);
    try {
      const body = {
        medications: review.medications.map((m) => ({
          name: m.name.trim(),
          dosage: m.dosage.trim(),
          frequency: m.frequency.trim() || 'As needed',
          timeSlots: m.timeSlots.split(',').map((s) => s.trim()).filter(Boolean),
          instructions: m.instructions.trim() || null,
          durationDays: m.durationDays.trim() ? Number(m.durationDays.trim()) : null,
        })),
        appointment:
          review.includeAppointment && review.appointment
            ? {
                doctorName: review.appointment.doctorName.trim(),
                hospital: review.appointment.hospital.trim() || null,
                specialty: review.appointment.specialty.trim() || null,
                datetime: new Date(review.appointment.datetime).toISOString(),
                notes: review.appointment.notes.trim() || null,
              }
            : null,
      };
      const data = await healthApi.post<{ createdMedications: number; appointment: unknown }>(
        `/prescriptions/${review.prescriptionId}/confirm`,
        body,
      );
      setSaveSummary({ medications: data.createdMedications, appointment: Boolean(data.appointment) });
      setReview(null);
      prescriptions.reload();
      meds.reload();
      appts.reload();
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Could not save. Please try again.');
    } finally {
      setSavingReview(false);
    }
  }

  async function discardReview() {
    if (!review) return;
    if (!confirm('Discard this scan? Nothing has been saved to the calendar yet.')) return;
    try {
      await healthApi.del(`/prescriptions/${review.prescriptionId}`);
    } catch { /* ignore */ }
    setReview(null);
    setReviewError('');
    prescriptions.reload();
  }

  async function deletePrescription(id: string) {
    if (!confirm('Delete this prescription? Medications created from it will remain.')) return;
    try {
      await healthApi.del(`/prescriptions/${id}`);
      prescriptions.reload();
    } catch { /* ignore */ }
  }

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

  async function addMediaLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await healthApi.post('/media-links', {
        elderUserId: elderId,
        title: mediaForm.title,
        url: mediaForm.url,
        mediaType: mediaForm.mediaType,
        description: mediaForm.description || undefined,
      });
      setMediaForm({ title: '', url: '', mediaType: 'video', description: '' });
      setActiveForm(null);
      mediaLinks.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add link.');
    } finally {
      setBusy(false);
    }
  }

  async function removeMediaLink(id: string) {
    await healthApi.del(`/media-links/${id}`);
    mediaLinks.reload();
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

  async function deleteMed(id: string, name: string) {
    if (!confirm(`Delete ${name}? This removes it and its reminder history — this can't be undone. If you just want to stop reminders for now, use Pause instead.`)) return;
    try {
      await healthApi.del(`/medications/${id}`);
      meds.reload();
    } catch { /* ignore */ }
  }

  function startEditMed(m: Medication) {
    setEditingMedId(m.id);
    setEditMedForm({
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      timeSlots: m.timeSlots.join(', '),
      instructions: m.instructions ?? '',
      endDate: m.endDate ? m.endDate.slice(0, 10) : '',
    });
    setEditMedError('');
  }

  async function saveEditMed(id: string) {
    if (!editMedForm.name.trim() || !editMedForm.dosage.trim() || !editMedForm.timeSlots.trim()) {
      setEditMedError('Name, dosage, and at least one time are required.');
      return;
    }
    setSavingMed(true);
    setEditMedError('');
    try {
      await healthApi.patch(`/medications/${id}`, {
        name: editMedForm.name.trim(),
        dosage: editMedForm.dosage.trim(),
        frequency: editMedForm.frequency.trim() || 'As needed',
        timeSlots: editMedForm.timeSlots.split(',').map((s) => s.trim()).filter(Boolean),
        instructions: editMedForm.instructions.trim() || null,
        endDate: editMedForm.endDate || null,
      });
      setEditingMedId(null);
      meds.reload();
    } catch (err) {
      setEditMedError(err instanceof Error ? err.message : 'Could not save changes.');
    } finally {
      setSavingMed(false);
    }
  }

  async function cancelAppt(id: string) {
    try {
      await healthApi.del(`/appointments/${id}`);
      appts.reload();
    } catch { /* ignore */ }
  }

  return (
    <div>
      <Link href="/family/health" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <h1 className="text-2xl font-bold text-text">Health management</h1>
      <p className="mt-1 text-text-secondary">Manage medicines, appointments, and notes for your elder.</p>

      <HealthEssentials elderUserId={elderId} />

      {/* Recent mood — from the AI Companion's daily check-in on the elder's home page */}
      {(mood.data?.length ?? 0) > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-bold text-text">
            <Sparkles className="h-5 w-5 text-primary-600" /> Recent mood
          </h2>
          <p className="mt-1 text-sm text-text-secondary">From their daily AI Companion check-in.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {mood.data?.map((m) => (
              <div key={m.id} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm">
                <span className="text-base">{MOOD_META[m.mood].emoji}</span>
                <span className="font-semibold text-text">{MOOD_META[m.mood].label}</span>
                <span className="text-xs text-text-secondary">
                  {new Date(m.createdAt).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Prescription upload */}
      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-text">
          <Upload className="h-5 w-5 text-primary-600" /> Prescriptions
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Upload a prescription photo — AI will read it and set up the medicine calendar automatically.
        </p>

        <div className="mt-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadPrescription(f);
            }}
          />
          <Button
            variant="outline"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Reading prescription…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload prescription
              </>
            )}
          </Button>
        </div>

        {formError && !activeForm && (
          <p className="mt-2 text-sm text-danger-600">{formError}</p>
        )}

        {saveSummary && (
          <Card className="mt-3 border-success-200 bg-success-50">
            <CardContent className="py-4">
              <p className="font-semibold text-success-900">
                {saveSummary.medications > 0
                  ? `${saveSummary.medications} medication${saveSummary.medications === 1 ? '' : 's'} added to the calendar.`
                  : 'Saved — no medications were added.'}
                {saveSummary.appointment && ' Appointment added too.'}
              </p>
            </CardContent>
          </Card>
        )}

        {review && (
          <Card className="mt-3 border-primary-200">
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-text">Review what AI read from &ldquo;{review.fileName}&rdquo;</p>
                <button
                  onClick={discardReview}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-danger-50 hover:text-danger-600"
                  aria-label="Discard scan"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {review.aiNotes && (
                <p className="mt-1 text-sm text-text-secondary">{review.aiNotes}</p>
              )}
              {review.aiProvider && (
                <p className="mt-1 text-xs text-text-secondary">AI provider: {review.aiProvider}</p>
              )}

              <p className="mt-4 text-sm font-semibold text-text">Medications</p>
              {review.medications.length === 0 && (
                <p className="mt-1 text-sm text-text-secondary">Nothing extracted — add medications manually below.</p>
              )}
              <div className="mt-2 flex flex-col gap-3">
                {review.medications.map((m) => (
                  <div key={m.key} className="rounded-xl border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="grid flex-1 gap-2 sm:grid-cols-2">
                        <Input
                          value={m.name}
                          onChange={(e) => updateReviewMed(m.key, 'name', e.target.value)}
                          placeholder="Medicine name"
                        />
                        <Input
                          value={m.dosage}
                          onChange={(e) => updateReviewMed(m.key, 'dosage', e.target.value)}
                          placeholder="Dosage, e.g. 5mg"
                        />
                        <Input
                          value={m.frequency}
                          onChange={(e) => updateReviewMed(m.key, 'frequency', e.target.value)}
                          placeholder="Frequency, e.g. Twice daily"
                        />
                        <Input
                          value={m.timeSlots}
                          onChange={(e) => updateReviewMed(m.key, 'timeSlots', e.target.value)}
                          placeholder="Times, e.g. 08:00, 20:00"
                        />
                        <Input
                          value={m.instructions}
                          onChange={(e) => updateReviewMed(m.key, 'instructions', e.target.value)}
                          placeholder="Instructions (optional), e.g. After meals"
                        />
                        <Input
                          value={m.durationDays}
                          onChange={(e) => updateReviewMed(m.key, 'durationDays', e.target.value.replace(/[^\d]/g, ''))}
                          placeholder="Course length in days (blank = ongoing)"
                        />
                      </div>
                      <button
                        onClick={() => removeReviewMed(m.key)}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-danger-50 hover:text-danger-600"
                        aria-label="Remove medication"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-2" onClick={addReviewMedRow}>
                <Plus className="h-4 w-4" /> Add another medication
              </Button>

              {review.appointment && (
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-text">Follow-up appointment found</p>
                    <label className="flex items-center gap-2 text-sm text-text-secondary">
                      <input
                        type="checkbox"
                        checked={review.includeAppointment}
                        onChange={(e) => setReview((r) => r && { ...r, includeAppointment: e.target.checked })}
                      />
                      Add to calendar
                    </label>
                  </div>
                  {review.includeAppointment && (
                    <div className="mt-2 grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2">
                      <Input
                        value={review.appointment.doctorName}
                        onChange={(e) => updateReviewAppt('doctorName', e.target.value)}
                        placeholder="Doctor name"
                      />
                      <Input
                        type="datetime-local"
                        value={review.appointment.datetime}
                        onChange={(e) => updateReviewAppt('datetime', e.target.value)}
                      />
                      <Input
                        value={review.appointment.hospital}
                        onChange={(e) => updateReviewAppt('hospital', e.target.value)}
                        placeholder="Hospital (optional)"
                      />
                      <Input
                        value={review.appointment.specialty}
                        onChange={(e) => updateReviewAppt('specialty', e.target.value)}
                        placeholder="Specialty (optional)"
                      />
                      <Input
                        className="sm:col-span-2"
                        value={review.appointment.notes}
                        onChange={(e) => updateReviewAppt('notes', e.target.value)}
                        placeholder="Notes (optional)"
                      />
                    </div>
                  )}
                </div>
              )}

              {reviewError && <p className="mt-3 text-sm text-danger-600">{reviewError}</p>}

              <div className="mt-4 flex gap-2">
                <Button onClick={saveReview} disabled={savingReview}>
                  {savingReview ? 'Saving…' : 'Save to calendar'}
                </Button>
                <Button variant="outline" onClick={discardReview} disabled={savingReview}>
                  Discard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {prescriptions.loading ? (
          <p className="mt-3 text-text-secondary">Loading…</p>
        ) : (prescriptions.data?.length ?? 0) > 0 && (
          <div className="mt-3 flex flex-col gap-3">
            {prescriptions.data?.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex items-start justify-between gap-3 pt-6">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-text">{p.fileName}</p>
                      {!p.reviewed && <Badge variant="accent">Needs review</Badge>}
                    </div>
                    <p className="text-sm text-text-secondary">
                      {p.doctorName && `${p.doctorName} · `}
                      {p.hospitalName && `${p.hospitalName} · `}
                      {p.prescriptionDate
                        ? new Date(p.prescriptionDate).toLocaleDateString()
                        : new Date(p.createdAt).toLocaleDateString()}
                    </p>
                    {p.medications.length > 0 && (
                      <p className="mt-1 text-xs text-text-secondary">
                        {p.medications.length} med{p.medications.length === 1 ? '' : 's'}: {p.medications.map((m) => m.name).join(', ')}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-text-secondary">Uploaded by {p.uploadedBy.name}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <a
                      href={p.filePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-text-secondary hover:bg-primary-50"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => deletePrescription(p.id)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-text-secondary hover:bg-danger-50 hover:text-danger-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Medications */}
      <section className="mt-8">
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
                {formError && activeForm === 'medications' && <p className="text-sm text-danger-600">{formError}</p>}
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
            {meds.data?.map((m) =>
              editingMedId === m.id ? (
                <Card key={m.id} className="sm:col-span-2">
                  <CardContent className="flex flex-col gap-3 pt-6">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`edit-name-${m.id}`}>Medicine name</Label>
                        <Input id={`edit-name-${m.id}`} value={editMedForm.name} onChange={(e) => setEditMedForm((f) => ({ ...f, name: e.target.value }))} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`edit-dosage-${m.id}`}>Dosage</Label>
                        <Input id={`edit-dosage-${m.id}`} value={editMedForm.dosage} onChange={(e) => setEditMedForm((f) => ({ ...f, dosage: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`edit-frequency-${m.id}`}>Frequency</Label>
                        <Input id={`edit-frequency-${m.id}`} value={editMedForm.frequency} onChange={(e) => setEditMedForm((f) => ({ ...f, frequency: e.target.value }))} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`edit-times-${m.id}`}>Times (comma-separated, 24h)</Label>
                        <Input id={`edit-times-${m.id}`} value={editMedForm.timeSlots} onChange={(e) => setEditMedForm((f) => ({ ...f, timeSlots: e.target.value }))} placeholder="08:00, 20:00" />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`edit-instructions-${m.id}`}>Instructions (optional)</Label>
                        <Input id={`edit-instructions-${m.id}`} value={editMedForm.instructions} onChange={(e) => setEditMedForm((f) => ({ ...f, instructions: e.target.value }))} placeholder="After meals" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`edit-enddate-${m.id}`}>Ends on (optional — leave blank if ongoing)</Label>
                        <Input id={`edit-enddate-${m.id}`} type="date" value={editMedForm.endDate} onChange={(e) => setEditMedForm((f) => ({ ...f, endDate: e.target.value }))} />
                      </div>
                    </div>
                    {editMedError && <p className="text-sm text-danger-600">{editMedError}</p>}
                    <div className="flex gap-2">
                      <Button size="sm" disabled={savingMed} onClick={() => saveEditMed(m.id)}>
                        {savingMed ? 'Saving…' : 'Save'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingMedId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card key={m.id} className={m.isActive ? '' : 'opacity-60'}>
                  <CardContent className="flex items-start justify-between gap-3 pt-6">
                    <div className="min-w-0">
                      <p className="font-bold text-text">{m.name} — {m.dosage}</p>
                      <p className="text-sm text-text-secondary">{m.frequency} · {(m.timeSlots as string[]).join(', ')}</p>
                      {m.instructions && <p className="mt-1 text-sm text-text-secondary">{m.instructions}</p>}
                      {m.endDate && (
                        <p className="mt-1 text-xs text-accent-600">
                          Course ends {new Date(m.endDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEditMed(m)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleMed(m.id, m.isActive)}>
                        {m.isActive ? 'Pause' : 'Resume'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-danger-600 hover:bg-danger-50"
                        onClick={() => deleteMed(m.id, m.name)}
                        aria-label={`Delete ${m.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ),
            )}
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
                {formError && activeForm === 'appointments' && <p className="text-sm text-danger-600">{formError}</p>}
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

      {/* Videos & music — caregiver-curated links, distinct from the admin-curated
          Wellness list the elder also sees. */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-text">
            <Video className="h-5 w-5 text-primary-600" /> Videos & music
          </h2>
          <Button size="sm" onClick={() => setActiveForm(activeForm === 'media' ? null : 'media')}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {activeForm === 'media' && (
          <Card className="mt-3">
            <CardContent className="pt-6">
              <form onSubmit={addMediaLink} className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="mediaTitle">Title</Label>
                    <Input id="mediaTitle" value={mediaForm.title} onChange={(e) => setMediaForm((f) => ({ ...f, title: e.target.value }))} placeholder="Morning bhajans" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="mediaType">Type</Label>
                    <select
                      id="mediaType"
                      value={mediaForm.mediaType}
                      onChange={(e) => setMediaForm((f) => ({ ...f, mediaType: e.target.value as 'video' | 'music' }))}
                      className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                    >
                      <option value="video">Video</option>
                      <option value="music">Music</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="mediaUrl">Link</Label>
                  <Input id="mediaUrl" value={mediaForm.url} onChange={(e) => setMediaForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://youtube.com/…" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="mediaDescription">Description (optional)</Label>
                  <Input id="mediaDescription" value={mediaForm.description} onChange={(e) => setMediaForm((f) => ({ ...f, description: e.target.value }))} placeholder="Their favourite Sunday morning playlist" />
                </div>
                {formError && activeForm === 'media' && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy || !mediaForm.title || !mediaForm.url}>
                  {busy ? 'Adding…' : 'Add link'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {mediaLinks.loading ? (
          <p className="mt-3 text-text-secondary">Loading…</p>
        ) : (mediaLinks.data?.length ?? 0) === 0 ? (
          <Card className="mt-3"><CardContent className="py-8 text-center text-text-secondary">No links added yet.</CardContent></Card>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {mediaLinks.data?.map((link) => (
              <Card key={link.id}>
                <CardContent className="flex items-start justify-between gap-3 pt-6">
                  <div className="min-w-0">
                    <Badge variant="muted">{link.mediaType}</Badge>
                    <p className="mt-1 truncate font-bold text-text">{link.title}</p>
                    {link.description && <p className="truncate text-sm text-text-secondary">{link.description}</p>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => removeMediaLink(link.id)}>
                    Remove
                  </Button>
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
                {formError && activeForm === 'notes' && <p className="text-sm text-danger-600">{formError}</p>}
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
