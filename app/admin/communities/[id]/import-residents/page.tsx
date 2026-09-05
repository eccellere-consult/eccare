'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface ImportRow {
  rowNumber: number;
  name: string;
  age: number | null;
  houseNumber: string | null;
  email: string | null;
  rawPhone: string;
  phone: string | null;
  role: 'elder' | 'caregiver' | null;
  status: 'ready' | 'bad-phone' | 'bad-age' | 'duplicate-in-file' | 'duplicate-existing';
  existingUser?: { id: string; name: string } | null;
}

const STATUS_LABEL: Record<ImportRow['status'], string> = {
  ready: 'Ready',
  'bad-phone': 'No usable phone',
  'bad-age': 'Age missing/invalid',
  'duplicate-in-file': 'Duplicate in file',
  'duplicate-existing': 'Already registered',
};
const STATUS_VARIANT: Record<ImportRow['status'], 'success' | 'danger' | 'muted' | 'accent'> = {
  ready: 'success',
  'bad-phone': 'danger',
  'bad-age': 'danger',
  'duplicate-in-file': 'accent',
  'duplicate-existing': 'accent',
};

export default function ImportResidentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: neighborhoodId } = use(params);

  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  async function preview(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('neighborhoodId', neighborhoodId);
      const res = await fetch('/api/v1/community/import-residents', { method: 'POST', credentials: 'include', body });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not read the file.');
      const newRows: ImportRow[] = json.data.rows;
      setRows(newRows);
      setIncluded(new Set(newRows.filter((r) => r.status === 'ready').map((r) => r.rowNumber)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the file.');
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    if (!file || !rows) return;
    if (password.length < 8) {
      setError('Set a default password of at least 8 characters before importing.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('neighborhoodId', neighborhoodId);
      body.append('commit', 'true');
      body.append('password', password);
      body.append('includeRows', JSON.stringify(Array.from(included)));
      const res = await fetch('/api/v1/community/import-residents', { method: 'POST', credentials: 'include', body });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Import failed.');
      setResult({ created: json.data.created, skipped: json.data.skipped });
      setRows(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setLoading(false);
    }
  }

  async function deleteExisting(row: ImportRow) {
    if (!row.existingUser) return;
    const typed = prompt(
      `This permanently deletes "${row.existingUser.name}"'s account and everything tied to it (health records, medications, family links, order history — all of it). This cannot be undone.\n\nType their exact name to confirm:`,
    );
    if (typed === null) return;
    setDeletingUserId(row.existingUser.id);
    try {
      const res = await fetch(
        `/api/v1/admin/users/${row.existingUser.id}?confirmName=${encodeURIComponent(typed)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not delete.');
      // Re-run preview so this row re-evaluates without the now-deleted conflict.
      setRows((prev) => prev?.map((r) => (r.rowNumber === row.rowNumber ? { ...r, status: 'ready', existingUser: null } : r)) ?? null);
      setIncluded((prev) => new Set(prev).add(row.rowNumber));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete.');
    } finally {
      setDeletingUserId(null);
    }
  }

  function toggle(rowNumber: number) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  return (
    <div>
      <Link
        href={`/admin/communities/${neighborhoodId}`}
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-primary-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to community
      </Link>

      <h1 className="mt-3 text-2xl font-bold text-text">Bulk-register residents</h1>
      <p className="mt-1 text-text-secondary">
        Upload a resident register (.xlsx) with Name, Age, House Name/No, Email, and Mobile No. columns —
        column order doesn&rsquo;t matter. Residents 60 and over are registered as Elder; under 60 as Family
        member. Rows with no usable phone number are skipped automatically (phone is how everyone signs in).
      </p>

      {result && (
        <Card className="mt-4 border-success-100 bg-success-50">
          <CardContent className="pt-6 text-success-900">
            Imported {result.created} resident{result.created === 1 ? '' : 's'}
            {result.skipped > 0 ? ` — ${result.skipped} row${result.skipped === 1 ? '' : 's'} skipped.` : '.'}
          </CardContent>
        </Card>
      )}

      {!rows && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <form onSubmit={preview} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="file">Resident register (.xlsx)</Label>
                <Input id="file" type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              {error && <p className="text-sm text-danger-600">{error}</p>}
              <Button type="submit" disabled={!file || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {loading ? 'Reading…' : 'Preview'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {rows && (
        <>
          <Card className="mt-4">
            <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="password">Default password for all imported residents</Label>
                <Input
                  id="password"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
                <p className="text-xs text-text-secondary">
                  Share this with residents so they can sign in with their phone number — recommend they change
                  it from Profile afterward.
                </p>
              </div>
              <Button onClick={commit} disabled={loading || included.size === 0}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? 'Importing…' : `Import ${included.size} resident${included.size === 1 ? '' : 's'}`}
              </Button>
            </CardContent>
          </Card>
          {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}

          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-text-secondary">
                  <th className="px-3 py-2 font-semibold"></th>
                  <th className="px-3 py-2 font-semibold">Row</th>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Age → Role</th>
                  <th className="px-3 py-2 font-semibold">House No.</th>
                  <th className="px-3 py-2 font-semibold">Phone</th>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const disabled = row.status === 'bad-phone' || row.status === 'bad-age';
                  return (
                    <tr key={row.rowNumber} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={included.has(row.rowNumber)}
                          disabled={disabled}
                          onChange={() => toggle(row.rowNumber)}
                        />
                      </td>
                      <td className="px-3 py-2 text-text-secondary">{row.rowNumber}</td>
                      <td className="px-3 py-2 font-semibold text-text">{row.name}</td>
                      <td className="px-3 py-2 text-text-secondary">
                        {row.age ?? '—'} {row.role && `→ ${row.role === 'elder' ? 'Elder' : 'Family member'}`}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">{row.houseNumber ?? '—'}</td>
                      <td className="px-3 py-2 text-text-secondary">{row.phone ?? (row.rawPhone || '—')}</td>
                      <td className="px-3 py-2 text-text-secondary">{row.email ?? '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                          {row.status === 'duplicate-existing' && row.existingUser && (
                            <>
                              <span className="text-xs text-text-secondary">
                                Conflicts with existing: {row.existingUser.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => deleteExisting(row)}
                                disabled={deletingUserId === row.existingUser.id}
                                className="flex items-center gap-1 text-xs font-semibold text-danger-600 hover:underline disabled:opacity-50"
                              >
                                <Trash2 className="h-3 w-3" />
                                {deletingUserId === row.existingUser.id ? 'Deleting…' : 'Delete existing account'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-xs text-text-secondary">
            <AlertTriangle className="h-3.5 w-3.5" />
            House No. is saved to each resident&rsquo;s own profile and community membership.
          </p>
        </>
      )}
    </div>
  );
}
