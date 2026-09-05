'use client';

import { useRef, useState } from 'react';
import { Upload, Loader2, X, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { healthApi } from '@/lib/health-client';

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

interface Props {
  /** Omit for an elder uploading their own prescription; pass the elder's id
   *  for a caregiver uploading on their behalf. requireHealthAccess resolves
   *  either case identically server-side — this only affects what gets sent. */
  elderUserId?: string;
  /** Called after a successful save-to-calendar or delete, so the parent
   *  page's own prescriptions/medications/appointments queries refresh. */
  onSaved?: () => void;
}

/** Upload a prescription photo, review what AI read from it (editable —
 *  nothing commits to the medicine calendar until Save), then confirm or
 *  discard. Shared between the elder's own Health page and the family
 *  per-elder page — the backend (requireHealthAccess) already allowed an
 *  elder to upload their own prescription; only the caregiver page ever had
 *  this UI before. */
export function PrescriptionUploadSection({ elderUserId, onSaved }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [review, setReview] = useState<ReviewState | null>(null);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [saveSummary, setSaveSummary] = useState<{ medications: number; appointment: boolean } | null>(null);
  const reviewKeyCounter = useRef(0);
  const nextReviewKey = () => (reviewKeyCounter.current += 1);

  async function uploadPrescription(file: File) {
    setUploading(true);
    setReview(null);
    setSaveSummary(null);
    setUploadError('');
    setReviewError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (elderUserId) formData.append('elderUserId', elderUserId);

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
      onSaved?.();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
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
      onSaved?.();
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
    onSaved?.();
  }

  return (
    <>
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
        <Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()} className="gap-2">
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

      {uploadError && <p className="mt-2 text-sm text-danger-600">{uploadError}</p>}

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
            {review.aiNotes && <p className="mt-1 text-sm text-text-secondary">{review.aiNotes}</p>}
            {review.aiProvider && <p className="mt-1 text-xs text-text-secondary">AI provider: {review.aiProvider}</p>}

            <p className="mt-4 text-sm font-semibold text-text">Medications</p>
            {review.medications.length === 0 && (
              <p className="mt-1 text-sm text-text-secondary">Nothing extracted — add medications manually below.</p>
            )}
            <div className="mt-2 flex flex-col gap-3">
              {review.medications.map((m) => (
                <div key={m.key} className="rounded-xl border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="grid flex-1 gap-2 sm:grid-cols-2">
                      <Input value={m.name} onChange={(e) => updateReviewMed(m.key, 'name', e.target.value)} placeholder="Medicine name" />
                      <Input value={m.dosage} onChange={(e) => updateReviewMed(m.key, 'dosage', e.target.value)} placeholder="Dosage, e.g. 5mg" />
                      <Input value={m.frequency} onChange={(e) => updateReviewMed(m.key, 'frequency', e.target.value)} placeholder="Frequency, e.g. Twice daily" />
                      <Input value={m.timeSlots} onChange={(e) => updateReviewMed(m.key, 'timeSlots', e.target.value)} placeholder="Times, e.g. 08:00, 20:00" />
                      <Input value={m.instructions} onChange={(e) => updateReviewMed(m.key, 'instructions', e.target.value)} placeholder="Instructions (optional), e.g. After meals" />
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
                    <Input value={review.appointment.doctorName} onChange={(e) => updateReviewAppt('doctorName', e.target.value)} placeholder="Doctor name" />
                    <Input type="datetime-local" value={review.appointment.datetime} onChange={(e) => updateReviewAppt('datetime', e.target.value)} />
                    <Input value={review.appointment.hospital} onChange={(e) => updateReviewAppt('hospital', e.target.value)} placeholder="Hospital (optional)" />
                    <Input value={review.appointment.specialty} onChange={(e) => updateReviewAppt('specialty', e.target.value)} placeholder="Specialty (optional)" />
                    <Input className="sm:col-span-2" value={review.appointment.notes} onChange={(e) => updateReviewAppt('notes', e.target.value)} placeholder="Notes (optional)" />
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
    </>
  );
}
