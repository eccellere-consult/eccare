'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Stethoscope,
  Hospital,
  ShieldCheck,
  Activity,
  Watch,
  Plus,
  Eye,
  Trash2,
  Loader2,
  Check,
  Upload,
  Pencil,
  Trash,
  MessageCircle,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { healthApi, useHealthData } from '@/lib/health-client';

interface Props {
  /** Omit on the elder's own page; pass through on the family/caregiver page for
   *  that elder — same convention used by every other health-domain fetch. */
  elderUserId?: string;
}

interface DoctorHospitalProfile {
  familyDoctorName: string | null;
  familyDoctorPhone: string | null;
  familyDoctorVideoLink: string | null;
  preferredHospitalName: string | null;
  preferredHospitalLocation: string | null;
}

/** No paid WhatsApp Business API here — same wa.me share-intent pattern as
 *  app/admin/invite/page.tsx and the Police button, just opening a chat rather
 *  than pre-filling a message. */
function waLink(phone: string): string {
  return `https://wa.me/${phone.replace(/[^\d]/g, '')}`;
}

type CoverageType = 'hospital_plan' | 'insurance_plan' | 'diagnostics' | 'wearable_gadget';

interface CoverageItem {
  id: string;
  type: CoverageType;
  label: string;
  provider: string | null;
  policyNumber: string | null;
  filePath: string | null;
  fileName: string | null;
  notes: string | null;
  addedBy: { name: string; role: string };
}

// 'diagnostics' gets its own dedicated "Diagnostic Reports" section below (upload-
// first, correctly-worded for a single lab/scan result) rather than living in this
// generic list — it was previously filed under Coverage & devices, worded and
// laid out for insurance/membership records (a "Policy number" field makes no
// sense on a blood test), which made an already-supported upload capability hard
// to find and confusing to fill in.
const COVERAGE_TYPES: { key: CoverageType; label: string; icon: LucideIcon }[] = [
  { key: 'hospital_plan', label: 'Hospital health plan', icon: Hospital },
  { key: 'insurance_plan', label: 'Medical insurance', icon: ShieldCheck },
  { key: 'wearable_gadget', label: 'Wearables & gadgets', icon: Watch },
];

const EMPTY_FORM = {
  familyDoctorName: '',
  familyDoctorPhone: '',
  familyDoctorVideoLink: '',
  preferredHospitalName: '',
  preferredHospitalLocation: '',
};

export function HealthEssentials({ elderUserId }: Props) {
  const qs = elderUserId ? `?elderUserId=${elderUserId}` : '';
  const profile = useHealthData<DoctorHospitalProfile>(`/profile${qs}`);
  const coverage = useHealthData<CoverageItem[]>(`/coverage${qs}`);

  // Family doctor & hospital card
  const [form, setForm] = useState(EMPTY_FORM);
  const [formLoaded, setFormLoaded] = useState(false);
  useEffect(() => {
    if (profile.data && !formLoaded) {
      setForm({
        familyDoctorName: profile.data.familyDoctorName ?? '',
        familyDoctorPhone: profile.data.familyDoctorPhone ?? '',
        familyDoctorVideoLink: profile.data.familyDoctorVideoLink ?? '',
        preferredHospitalName: profile.data.preferredHospitalName ?? '',
        preferredHospitalLocation: profile.data.preferredHospitalLocation ?? '',
      });
      setFormLoaded(true);
    }
  }, [profile.data, formLoaded]);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState(false);

  const hasProfileData = Boolean(
    profile.data?.familyDoctorName ||
      profile.data?.familyDoctorPhone ||
      profile.data?.preferredHospitalName ||
      profile.data?.preferredHospitalLocation,
  );

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError('');
    try {
      const saved = await healthApi.patch<DoctorHospitalProfile>('/profile', { elderUserId, ...form });
      // Trust the server's response, not just the form the elder just typed — if a
      // write silently failed to persist (stale generated client, a rejected value,
      // anything), this is what surfaces it instead of the UI lying that it worked.
      profile.setData(saved);
      setEditingProfile(false);
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 2000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not save. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function deleteProfile() {
    if (!confirm('Remove the family doctor and hospital details?')) return;
    setDeletingProfile(true);
    setProfileError('');
    try {
      const cleared = await healthApi.patch<DoctorHospitalProfile>('/profile', {
        elderUserId,
        familyDoctorName: null,
        familyDoctorPhone: null,
        familyDoctorVideoLink: null,
        preferredHospitalName: null,
        preferredHospitalLocation: null,
      });
      profile.setData(cleared);
      setForm(EMPTY_FORM);
      setEditingProfile(false);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not remove. Please try again.');
    } finally {
      setDeletingProfile(false);
    }
  }

  // Coverage & devices card
  const [activeType, setActiveType] = useState<CoverageType | null>(null);
  const [coverageForm, setCoverageForm] = useState({ label: '', provider: '', policyNumber: '', notes: '' });
  const [addingCoverage, setAddingCoverage] = useState(false);
  const [coverageError, setCoverageError] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function addCoverage(e: React.FormEvent) {
    e.preventDefault();
    if (!activeType) return;
    setAddingCoverage(true);
    setCoverageError('');
    try {
      await healthApi.post('/coverage', {
        elderUserId,
        type: activeType,
        label: coverageForm.label,
        provider: coverageForm.provider || undefined,
        policyNumber: coverageForm.policyNumber || undefined,
        notes: coverageForm.notes || undefined,
      });
      setCoverageForm({ label: '', provider: '', policyNumber: '', notes: '' });
      setActiveType(null);
      coverage.reload();
    } catch (err) {
      setCoverageError(err instanceof Error ? err.message : 'Could not add.');
    } finally {
      setAddingCoverage(false);
    }
  }

  async function removeCoverage(id: string) {
    setRemovingId(id);
    try {
      await healthApi.del(`/coverage/${id}`);
      coverage.reload();
    } finally {
      setRemovingId(null);
    }
  }

  async function uploadDocument(id: string, file: File) {
    setUploadingId(id);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`/api/v1/health/coverage/${id}/document`, {
        method: 'POST',
        credentials: 'include',
        body,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Upload failed.');
      coverage.reload();
    } catch (err) {
      setCoverageError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadingId(null);
    }
  }

  const itemsByType = (type: CoverageType) => (coverage.data ?? []).filter((c) => c.type === type);

  return (
    <>
      {/* Family doctor & hospital */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-text">
          <Stethoscope className="h-5 w-5 text-primary-600" />
          Family doctor & hospital
        </h2>
        <Card className="mt-3">
          <CardContent className="pt-6">
            {profile.loading ? (
              <p className="text-text-secondary">Loading…</p>
            ) : hasProfileData && !editingProfile ? (
              <div className="flex flex-col gap-3">
                {profile.data?.familyDoctorName && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase text-text-secondary">Family doctor</p>
                      <p className="truncate font-bold text-text">{profile.data.familyDoctorName}</p>
                      {profile.data.familyDoctorPhone && (
                        <p className="truncate text-sm text-text-secondary">{profile.data.familyDoctorPhone}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {profile.data.familyDoctorPhone && (
                        <>
                          <a
                            href={`tel:${profile.data.familyDoctorPhone}`}
                            aria-label="Call family doctor"
                            className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white"
                          >
                            <Stethoscope className="h-5 w-5" />
                          </a>
                          <a
                            href={waLink(profile.data.familyDoctorPhone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="WhatsApp family doctor"
                            className="flex h-11 w-11 items-center justify-center rounded-xl bg-success-600 text-white"
                          >
                            <MessageCircle className="h-5 w-5" />
                          </a>
                        </>
                      )}
                      {profile.data.familyDoctorVideoLink && (
                        <a
                          href={profile.data.familyDoctorVideoLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Video call family doctor"
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary-600 text-primary-600"
                        >
                          <Video className="h-5 w-5" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {profile.data?.preferredHospitalName && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-text-secondary">Preferred hospital</p>
                    <p className="font-bold text-text">{profile.data.preferredHospitalName}</p>
                    {profile.data.preferredHospitalLocation && (
                      <p className="text-sm text-text-secondary">{profile.data.preferredHospitalLocation}</p>
                    )}
                  </div>
                )}
                {profileError && <p className="text-sm text-danger-600">{profileError}</p>}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingProfile(true)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={deletingProfile} onClick={deleteProfile}>
                    <Trash className="h-4 w-4" /> {deletingProfile ? 'Removing…' : 'Delete'}
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="he-doc-name">Family doctor name</Label>
                  <Input
                    id="he-doc-name"
                    value={form.familyDoctorName}
                    onChange={(e) => setForm((f) => ({ ...f, familyDoctorName: e.target.value }))}
                    placeholder="Dr. Sharma"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="he-doc-phone">Family doctor phone</Label>
                  <div className="flex gap-2">
                    <Input
                      id="he-doc-phone"
                      value={form.familyDoctorPhone}
                      onChange={(e) => setForm((f) => ({ ...f, familyDoctorPhone: e.target.value }))}
                      placeholder="9876543210"
                    />
                    {form.familyDoctorPhone && (
                      <>
                        <a
                          href={`tel:${form.familyDoctorPhone}`}
                          aria-label="Call family doctor"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white"
                        >
                          <Stethoscope className="h-5 w-5" />
                        </a>
                        <a
                          href={waLink(form.familyDoctorPhone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="WhatsApp family doctor"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success-600 text-white"
                        >
                          <MessageCircle className="h-5 w-5" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="he-doc-video">Video call link (Google Meet, etc. — optional)</Label>
                  <Input
                    id="he-doc-video"
                    value={form.familyDoctorVideoLink}
                    onChange={(e) => setForm((f) => ({ ...f, familyDoctorVideoLink: e.target.value }))}
                    placeholder="https://meet.google.com/…"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="he-hosp-name">Preferred / regular hospital</Label>
                  <Input
                    id="he-hosp-name"
                    value={form.preferredHospitalName}
                    onChange={(e) => setForm((f) => ({ ...f, preferredHospitalName: e.target.value }))}
                    placeholder="City Care Hospital"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="he-hosp-loc">Hospital location</Label>
                  <Input
                    id="he-hosp-loc"
                    value={form.preferredHospitalLocation}
                    onChange={(e) => setForm((f) => ({ ...f, preferredHospitalLocation: e.target.value }))}
                    placeholder="MG Road, Bengaluru"
                  />
                </div>
                {profileError && <p className="sm:col-span-2 text-sm text-danger-600">{profileError}</p>}
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" disabled={savingProfile}>
                    {savingProfile ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                    ) : savedProfile ? (
                      <><Check className="h-4 w-4" /> Saved</>
                    ) : (
                      'Save'
                    )}
                  </Button>
                  {hasProfileData && (
                    <Button type="button" variant="outline" onClick={() => setEditingProfile(false)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Diagnostic Reports — upload-first, its own section (see the note on
          COVERAGE_TYPES above for why this isn't lumped in with Coverage & devices). */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-text">
          <Activity className="h-5 w-5 text-primary-600" />
          Diagnostic reports
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Upload lab results, scans, and other diagnostic reports to keep them all in one place.
        </p>

        <div className="mt-3">
          <Button
            type="button"
            size="sm"
            variant={activeType === 'diagnostics' ? 'primary' : 'outline'}
            onClick={() => setActiveType(activeType === 'diagnostics' ? null : 'diagnostics')}
          >
            <Plus className="h-4 w-4" />
            Add a diagnostic report
          </Button>
        </div>

        {activeType === 'diagnostics' && (
          <CoverageForm
            activeType={activeType}
            coverageForm={coverageForm}
            setCoverageForm={setCoverageForm}
            addCoverage={addCoverage}
            addingCoverage={addingCoverage}
            coverageError={coverageError}
            onCancel={() => setActiveType(null)}
          />
        )}

        <div className="mt-4 flex flex-col gap-2">
          {itemsByType('diagnostics').length === 0 && activeType !== 'diagnostics' && (
            <p className="text-sm text-text-secondary">No diagnostic reports uploaded yet.</p>
          )}
          {itemsByType('diagnostics').map((item) => (
            <CoverageItemRow
              key={item.id}
              item={item}
              uploadingId={uploadingId}
              removingId={removingId}
              fileInputs={fileInputs}
              uploadDocument={uploadDocument}
              removeCoverage={removeCoverage}
            />
          ))}
        </div>
      </section>

      {/* Coverage & devices */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-text">
          <ShieldCheck className="h-5 w-5 text-primary-600" />
          Coverage & devices
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Do they already have any of these? Add details and upload the card or policy if so.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {COVERAGE_TYPES.map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={activeType === key ? 'primary' : 'outline'}
              onClick={() => setActiveType(activeType === key ? null : key)}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>

        {activeType && activeType !== 'diagnostics' && (
          <CoverageForm
            activeType={activeType}
            coverageForm={coverageForm}
            setCoverageForm={setCoverageForm}
            addCoverage={addCoverage}
            addingCoverage={addingCoverage}
            coverageError={coverageError}
            onCancel={() => setActiveType(null)}
            typeLabel={COVERAGE_TYPES.find((c) => c.key === activeType)?.label.toLowerCase()}
          />
        )}

        <div className="mt-4 flex flex-col gap-4">
          {COVERAGE_TYPES.map(({ key, label, icon: Icon }) => {
            const items = itemsByType(key);
            if (items.length === 0) return null;
            return (
              <div key={key}>
                <p className="flex items-center gap-1.5 text-sm font-bold text-text-secondary">
                  <Icon className="h-4 w-4" /> {label}
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {items.map((item) => (
                    <CoverageItemRow
                      key={item.id}
                      item={item}
                      uploadingId={uploadingId}
                      removingId={removingId}
                      fileInputs={fileInputs}
                      uploadDocument={uploadDocument}
                      removeCoverage={removeCoverage}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

/** Shared by both the Diagnostic Reports and Coverage & devices sections — same
 *  underlying HealthCoverageItem record shape and upload/view/remove behavior,
 *  just grouped and worded differently above. */
function CoverageItemRow({
  item,
  uploadingId,
  removingId,
  fileInputs,
  uploadDocument,
  removeCoverage,
}: {
  item: CoverageItem;
  uploadingId: string | null;
  removingId: string | null;
  fileInputs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  uploadDocument: (id: string, file: File) => void;
  removeCoverage: (id: string) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-text">{item.label}</p>
        <p className="truncate text-sm text-text-secondary">
          {[item.provider, item.policyNumber].filter(Boolean).join(' · ')}
        </p>
      </div>
      {/* View and Upload/Replace are shown together, not either/or — a record whose
          filePath still points at a since-lost local upload (from before the R2
          migration) would otherwise leave a dead "View" link with no way back to
          re-upload. Matches the "Replace file" pattern already used for provider
          certifications, catalog images, and marketplace images. */}
      {item.filePath && (
        <a
          href={item.filePath}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View document for ${item.label}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-primary-600 hover:bg-primary-50"
        >
          <Eye className="h-5 w-5" />
        </a>
      )}
      <input
        ref={(el) => { fileInputs.current[item.id] = el; }}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadDocument(item.id, file);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={uploadingId === item.id}
        onClick={() => fileInputs.current[item.id]?.click()}
        aria-label={item.filePath ? `Replace document for ${item.label}` : `Upload document for ${item.label}`}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-primary-600 hover:bg-primary-50 disabled:opacity-50"
      >
        {uploadingId === item.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
      </button>
      <button
        type="button"
        disabled={removingId === item.id}
        onClick={() => removeCoverage(item.id)}
        aria-label={`Remove ${item.label}`}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
      >
        {removingId === item.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
      </button>
    </div>
  );
}

/** Shared add-form for both sections. Fields are worded for a diagnostic report
 *  when activeType === 'diagnostics' (a single report has no "policy number");
 *  otherwise worded generically for the Coverage & devices types. */
function CoverageForm({
  activeType,
  coverageForm,
  setCoverageForm,
  addCoverage,
  addingCoverage,
  coverageError,
  onCancel,
  typeLabel,
}: {
  activeType: CoverageType;
  coverageForm: { label: string; provider: string; policyNumber: string; notes: string };
  setCoverageForm: React.Dispatch<React.SetStateAction<{ label: string; provider: string; policyNumber: string; notes: string }>>;
  addCoverage: (e: React.FormEvent) => void;
  addingCoverage: boolean;
  coverageError: string;
  onCancel: () => void;
  typeLabel?: string;
}) {
  const isDiagnostic = activeType === 'diagnostics';
  return (
    <Card className="mt-3">
      <CardContent className="pt-6">
        <form onSubmit={addCoverage} className="flex flex-col gap-4">
          <p className="text-sm font-semibold text-text-secondary">
            {isDiagnostic ? 'Add a diagnostic report' : `Add ${typeLabel}`}
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cov-label">{isDiagnostic ? 'Report name' : 'Name'}</Label>
            <Input
              id="cov-label"
              value={coverageForm.label}
              onChange={(e) => setCoverageForm((f) => ({ ...f, label: e.target.value }))}
              placeholder={isDiagnostic ? 'Blood Test — Aug 2026' : 'Star Health — Family Floater'}
            />
          </div>
          <div className={isDiagnostic ? '' : 'grid gap-4 sm:grid-cols-2'}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cov-provider">{isDiagnostic ? 'Lab / hospital (optional)' : 'Provider (optional)'}</Label>
              <Input
                id="cov-provider"
                value={coverageForm.provider}
                onChange={(e) => setCoverageForm((f) => ({ ...f, provider: e.target.value }))}
                placeholder={isDiagnostic ? 'Apollo Diagnostics' : 'Star Health Insurance'}
              />
            </div>
            {/* A "policy number" doesn't apply to a single report. */}
            {!isDiagnostic && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="cov-policy">Policy / membership number (optional)</Label>
                <Input
                  id="cov-policy"
                  value={coverageForm.policyNumber}
                  onChange={(e) => setCoverageForm((f) => ({ ...f, policyNumber: e.target.value }))}
                  placeholder="POL123456"
                />
              </div>
            )}
          </div>
          {coverageError && <p className="text-sm text-danger-600">{coverageError}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={addingCoverage || !coverageForm.label}>
              {addingCoverage ? 'Adding…' : 'Add'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
