'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ResetPasswordButton } from '@/components/admin/reset-password-button';

type Role = 'elder' | 'caregiver' | 'admin' | 'provider';
interface UserRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: Role;
  claimed: boolean;
  createdAt: string;
}

const ROLE_VARIANT: Record<Role, 'default' | 'accent' | 'muted' | 'success'> = {
  elder: 'default',
  caregiver: 'accent',
  admin: 'muted',
  provider: 'success',
};

/** Checkbox column excludes the current admin's own row entirely (not just
 *  disabled) — the fastest way to guarantee "select all" can never catch
 *  your own account is to never make it selectable. The server route
 *  (POST /admin/users/bulk-delete) also strips it defensively either way. */
export function UsersTable({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const selectable = users.filter((u) => u.id !== currentUserId);
  const allSelected = selectable.length > 0 && selectable.every((u) => selected.has(u.id));
  const selectedUsers = selectable.filter((u) => selected.has(u.id));

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
      {selected.size > 0 && (
        <Card className="mt-4 border-danger-100 bg-danger-50">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <p className="text-sm font-semibold text-text">{selected.size} account{selected.size > 1 ? 's' : ''} selected</p>
            <Button size="sm" variant="danger" className="ml-auto" onClick={openConfirm}>
              <Trash2 className="h-4 w-4" /> Delete selected
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>Clear</Button>
          </CardContent>
        </Card>
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
