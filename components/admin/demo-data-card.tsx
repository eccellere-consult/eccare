'use client';

import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { communityApi, useCommunityData } from '@/lib/community-client';

interface DemoStatus {
  loaded: boolean;
  community: { name: string; joinCode: string; members: number } | null;
  demoPeople: number;
}
interface DemoResult {
  counts: Record<string, number>;
  accounts: Array<{ email: string; role: string; name: string; password: string }>;
  community: { name: string; joinCode: string };
}

const ROLE_LABEL: Record<string, string> = { elder: 'Elder', caregiver: 'Family', provider: 'Provider' };

/** Loads, refreshes or removes the sample data behind the three test logins
 *  (elder@, family@, provider@) so every module can be shown working. */
export function DemoDataCard() {
  const { data: status, loading, reload } = useCommunityData<DemoStatus>('/admin/demo-data');
  const [busy, setBusy] = useState<'load' | 'remove' | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<DemoResult | null>(null);

  async function load() {
    const message = status?.loaded
      ? 'Refresh the demo? The sample data is cleared and rebuilt with current dates. Anything you added to the elder, family or provider test accounts is replaced.'
      : 'Load the demo? This fills the elder, family and provider test accounts with sample data and adds a sample community with sample neighbours. The test accounts keep their passwords.';
    if (!confirm(message)) return;
    setBusy('load');
    setError('');
    setResult(null);
    try {
      setResult(await communityApi.post<DemoResult>('/admin/demo-data', {}));
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare the demo.');
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm('Remove all demo data? The sample community, sample people and the demo records on the three test accounts are deleted. The test accounts themselves stay.')) return;
    setBusy('remove');
    setError('');
    setResult(null);
    try {
      await communityApi.delete('/admin/demo-data');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the demo.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="mt-6 max-w-3xl">
      <CardContent className="pt-6">
        <h2 className="flex items-center gap-2 font-bold text-text">
          <FlaskConical className="h-5 w-5 text-primary-600" />
          Demo data
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Fills <strong>elder@eccare.in</strong>, <strong>family@eccare.in</strong> and <strong>provider@eccare.in</strong> with
          realistic sample data across every module — health, medicines, emergency alerts, community, services, orders,
          bills, advisory and property care — so each login can be demonstrated end to end. All names and numbers are
          fictional. Safe to refresh: it clears the previous demo first so dates stay current.
        </p>

        {loading ? (
          <p className="mt-4 text-text-secondary">Checking…</p>
        ) : (
          <p className="mt-4 text-sm text-text">
            {status?.loaded ? (
              <>
                Demo is <strong className="text-success-600">loaded</strong>: {status.community?.name}, {status.community?.members} members,
                join code <strong>{status.community?.joinCode}</strong>.
              </>
            ) : (
              <>Demo is <strong>not loaded</strong>.</>
            )}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={load} disabled={busy !== null || loading}>
            {busy === 'load' ? 'Working… this can take a minute' : status?.loaded ? 'Refresh demo data' : 'Load demo data'}
          </Button>
          {status?.loaded && (
            <Button variant="outline" onClick={remove} disabled={busy !== null} className="text-danger-600 hover:bg-danger-50">
              {busy === 'remove' ? 'Removing…' : 'Remove demo data'}
            </Button>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}

        {result && (
          <div className="mt-6 flex flex-col gap-5">
            <div>
              <h3 className="font-bold text-text">Demo logins</h3>
              <div className="mt-2 overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead className="bg-primary-50 text-xs uppercase tracking-wide text-text-secondary">
                    <tr><th className="px-3 py-2">Email</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Business / name</th><th className="px-3 py-2">Password</th></tr>
                  </thead>
                  <tbody>
                    {result.accounts.map((a) => (
                      <tr key={a.email} className="border-t border-border">
                        <td className="px-3 py-2 font-semibold text-text">{a.email}</td>
                        <td className="px-3 py-2 text-text-secondary">{ROLE_LABEL[a.role] ?? a.role}</td>
                        <td className="px-3 py-2 text-text-secondary">{a.name}</td>
                        <td className="px-3 py-2 text-text-secondary">{a.password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-text-secondary">
                The community is <strong>{result.community.name}</strong> (join code <strong>{result.community.joinCode}</strong>). The elder is a
                resident, the family member is its community admin. The other providers show how doctors, rides, advisory, property
                care, nursing and grocery work from the provider side.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-text">What was loaded</h3>
              <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {Object.entries(result.counts).map(([label, n]) => (
                  <li key={label} className="flex justify-between gap-3 border-b border-border py-1">
                    <span className="text-text-secondary">{label}</span>
                    <span className="font-semibold text-text">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
