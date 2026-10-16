'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle, UserPlus, Check, Loader2 } from 'lucide-react';
import { AllocatePanel, type AllocCommunity } from '@/components/admin/allocate-panel';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ResetPasswordButton } from '@/components/admin/reset-password-button';
import { ageOn, parseDateOfBirth, ELDER_AGE } from '@/lib/age';

type Role = 'elder' | 'caregiver' | 'admin' | 'provider';
interface UserRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: Role;
  claimed: boolean;
  createdAt: string;
  dateOfBirth: string | null;
  caregiverException: boolean;
  memberships: { status: 'approved' | 'pending'; house: string | null; communityId: string; communityName: string }[];
}
type View = 'all' | 'unassigned' | 'waiting';

const JOINABLE_ROLES: Role[] = ['elder', 'caregiver'];

/** Where a person stands with communities, with a one-tap Approve for a request that is waiting
 *  (it uses the house they gave; if they gave none, the Allocate panel asks for it). */
function CommunityCell({ user, onAllocate }: { user: UserRow; onAllocate: (user: UserRow) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!JOINABLE_ROLES.includes(user.role)) return <span className="text-text-secondary">—</span>;
  const approved = user.memberships.filter((m) => m.status === 'approved');
  const pending = user.memberships.filter((m) => m.status === 'pending');

  async function approve(m: UserRow['memberships'][number]) {
    if (!m.house) {
      onAllocate(user);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/v1/admin/community-allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ neighborhoodId: m.communityId, role: 'member', users: [{ userId: user.id, house: m.house }] }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not approve.');
      const r = json.data.results[0];
      if (r?.status === 'skipped') throw new Error(r.reason || 'Could not approve.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {approved.map((m) => (
        <span key={m.communityId} className="flex items-center gap-1.5 text-text">
          <Check className="h-3.5 w-3.5 text-success-600" />
          <span className="font-semibold">{m.communityName}</span>
          {m.house && <span className="text-xs text-text-secondary">· {m.house}</span>}
        </span>
      ))}
      {pending.map((m) => (
        <span key={m.communityId} className="flex flex-wrap items-center gap-2">
          <Badge variant="accent">Waiting</Badge>
          <span className="text-text">
            {m.communityName}
            {m.house && <span className="text-xs text-text-secondary"> · {m.house}</span>}
          </span>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => approve(m)}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
          </Button>
        </span>
      ))}
      {approved.length === 0 && pending.length === 0 && (
        <span className="flex items-center gap-2">
          <Badge variant="muted">Not in a community</Badge>
          <button type="button" onClick={() => onAllocate(user)} className="text-xs font-semibold text-primary-600 hover:underline">
            Allocate
          </button>
        </span>
      )}
      {error && <span className="text-xs text-danger-600">{error}</span>}
    </div>
  );
}

const ROLE_VARIANT: Record<Role, 'default' | 'accent' | 'muted' | 'success'> = {
  elder: 'default',
  caregiver: 'accent',
  admin: 'muted',
  provider: 'success',
};

/** Date of birth, the age it gives, and — for a family-member account — whether the
 *  age rule is locking them out (60+ with no exception) and a switch for an admin
 *  to allow it. Also the only place a date of birth can be corrected, since
 *  residents can't change their own once set. */
function AgeCell({ user }: { user: UserRow }) {
  const [dob, setDob] = useState(user.dateOfBirth);
  const [exception, setException] = useState(user.caregiverException);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const parsed = dob ? parseDateOfBirth(dob) : null;
  const age = parsed ? ageOn(parsed) : null;
  const locked = user.role === 'caregiver' && age !== null && age >= ELDER_AGE && !exception;

  async function patch(body: { caregiverException?: boolean; dateOfBirth?: string }) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not update.');
      if (body.caregiverException !== undefined) setException(json.data.caregiverException);
      if (body.dateOfBirth !== undefined) setDob(json.data.dateOfBirth ? String(json.data.dateOfBirth).slice(0, 10) : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update.');
    } finally {
      setBusy(false);
    }
  }

  function editDob() {
    const typed = prompt('Date of birth (YYYY-MM-DD):', dob ?? '');
    if (typed && typed.trim()) patch({ dateOfBirth: typed.trim() });
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-text">
        {age !== null ? `${age} yrs` : 'No DOB'}
        <button type="button" onClick={editDob} disabled={busy} className="ml-2 text-xs font-semibold text-primary-600 hover:underline disabled:opacity-50">
          {dob ? 'Edit' : 'Set'}
        </button>
      </span>
      {dob && <span className="text-xs text-text-secondary">{dob}</span>}
      {user.role === 'caregiver' && age !== null && age >= ELDER_AGE && (
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
          <input type="checkbox" checked={exception} disabled={busy} onChange={(e) => patch({ caregiverException: e.target.checked })} className="h-3.5 w-3.5" />
          Allow caregiver features
        </label>
      )}
      {locked && <Badge variant="danger">Locked by age rule</Badge>}
      {error && <span className="text-xs text-danger-600">{error}</span>}
    </div>
  );
}

/** Checkbox column excludes the current admin's own row entirely (not just
 *  disabled) — the fastest way to guarantee "select all" can never catch
 *  your own account is to never make it selectable. The server route
 *  (POST /admin/users/bulk-delete) also strips it defensively either way. */
export function UsersTable({
  users,
  currentUserId,
  communities,
  view,
  counts,
}: {
  users: UserRow[];
  currentUserId: string;
  communities: AllocCommunity[];
  view: View;
  counts: { unassigned: number; waiting: number };
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Who the Allocate panel is open for (a snapshot, so the list refreshing underneath doesn't change it).
  const [allocating, setAllocating] = useState<UserRow[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const selectable = users.filter((u) => u.id !== currentUserId);
  const allSelected = selectable.length > 0 && selectable.every((u) => selected.has(u.id));
  const selectedUsers = selectable.filter((u) => selected.has(u.id));
  const selectedJoinable = selectedUsers.filter((u) => JOINABLE_ROLES.includes(u.role));

  const tabs: { key: View; label: string; href: string; count?: number }[] = [
    { key: 'all', label: 'All users', href: '/admin/users' },
    { key: 'unassigned', label: 'Not in a community', href: '/admin/users?show=unassigned', count: counts.unassigned },
    { key: 'waiting', label: 'Waiting for approval', href: '/admin/users?show=waiting', count: counts.waiting },
  ];

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectable.map((u) => u.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openConfirm() {
    setConfirmText('');
    setError('');
    setConfirming(true);
  }

  async function confirmDelete() {
    setDeleting(true);
    setError('');
    try {
      const res = await fetch('/api/v1/admin/users/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: Array.from(selected), confirm: confirmText.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Could not delete the selected accounts.');
      setConfirming(false);
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the selected accounts.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter users">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            role="tab"
            aria-selected={view === t.key}
            className={cn(
              'flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors',
              view === t.key ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-border text-text-secondary hover:border-primary-300',
            )}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={cn('rounded-full px-2 py-0.5 text-xs', t.key === 'waiting' ? 'bg-accent-light text-accent-dark' : 'bg-primary-100 text-primary-900')}>{t.count}</span>
            )}
          </Link>
        ))}
      </div>

      {selected.size > 0 && (
        <Card className="mt-4 border-primary-100 bg-primary-50">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <p className="text-sm font-semibold text-text">{selected.size} account{selected.size > 1 ? 's' : ''} selected</p>
            {selectedJoinable.length > 0 && (
              <Button size="sm" className="ml-auto" onClick={() => setAllocating(selectedJoinable)}>
                <UserPlus className="h-4 w-4" /> Add {selectedJoinable.length} to a community
              </Button>
            )}
            <Button size="sm" variant="danger" className={selectedJoinable.length > 0 ? '' : 'ml-auto'} onClick={openConfirm}>
              <Trash2 className="h-4 w-4" /> Delete selected
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>Clear</Button>
          </CardContent>
        </Card>
      )}

      {allocating && (
        <AllocatePanel
          // A new set of people starts a fresh panel (house boxes, results).
          key={allocating.map((u) => u.id).join(',')}
          people={allocating.map((u) => ({
            id: u.id,
            name: u.name,
            phone: u.phone,
            email: u.email,
            pending: u.memberships.filter((m) => m.status === 'pending').map((m) => ({ communityId: m.communityId, house: m.house })),
          }))}
          communities={communities}
          onClose={() => {
            setAllocating(null);
            setSelected(new Set());
          }}
        />
      )}

      {confirming && (
        <Card className="mt-4 border-danger-100">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-danger-600" />
              <div>
                <p className="font-bold text-text">This can't be undone</p>
                <p className="mt-1 text-sm text-text-secondary">
                  Deleting an account permanently removes their medications, health records, family
                  links, SOS history, memories, orders, and community posts. You're about to delete:
                </p>
              </div>
            </div>

            <ul className="mt-3 max-h-40 overflow-y-auto rounded-xl border border-border bg-background p-3 text-sm text-text">
              {selectedUsers.map((u) => (
                <li key={u.id} className="py-0.5">
                  {u.name} <span className="text-text-secondary">— {u.role}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-col gap-1">
              <label htmlFor="bulk-delete-confirm" className="text-sm font-semibold text-text">
                Type <span className="font-mono">DELETE</span> to confirm
              </label>
              <Input
                id="bulk-delete-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                className="w-40"
              />
            </div>

            {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}

            <div className="mt-4 flex gap-2">
              <Button
                variant="danger"
                disabled={deleting || confirmText !== 'DELETE'}
                onClick={confirmDelete}
              >
                {deleting ? 'Deleting…' : `Delete ${selectedUsers.length} account${selectedUsers.length > 1 ? 's' : ''}`}
              </Button>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={deleting}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-border"
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Community</th>
                  <th className="px-4 py-3 font-semibold">Age</th>
                  <th className="px-4 py-3 font-semibold">Joined</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = user.id === currentUserId;
                  return (
                    <tr key={user.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        {!isSelf && (
                          <input
                            type="checkbox"
                            aria-label={`Select ${user.name}`}
                            checked={selected.has(user.id)}
                            onChange={() => toggleOne(user.id)}
                            className="h-4 w-4 rounded border-border"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-text">
                        {user.name}
                        {isSelf && <span className="ml-2 text-xs font-normal text-text-secondary">(you)</span>}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{user.phone ?? user.email ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={ROLE_VARIANT[user.role]}>{user.role}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <CommunityCell user={user} onAllocate={(u) => setAllocating([u])} />
                      </td>
                      <td className="px-4 py-3">
                        {user.role === 'elder' || user.role === 'caregiver' ? <AgeCell user={user} /> : <span className="text-text-secondary">—</span>}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <ResetPasswordButton userId={user.id} claimed={user.claimed} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
