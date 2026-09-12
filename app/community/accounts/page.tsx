'use client';

import { useState } from 'react';
import { IndianRupee, TrendingUp, TrendingDown, Wallet, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommunityPageFrame } from '@/components/community/page-frame';
import { communityApi, useCommunityData } from '@/lib/community-client';
import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';

interface LedgerRow { month: string; collected: number; spent: number; balance: number }
interface Summary { ledger: LedgerRow[]; totalCollected: number; totalSpent: number; currentBalance: number }
interface Expense {
  id: string;
  label: string;
  amount: string;
  category: string | null;
  spentOn: string;
  notes: string | null;
  addedBy: { id: string; name: string };
}
interface Me { memberships: { role: string }[] }

const EMPTY_FORM = { label: '', amount: '', category: '', spentOn: '', notes: '' };

export default function AccountsPage() {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');
  const { data: summary, loading, error } = useCommunityData<Summary>('/community/accounts/summary');
  const { data: expenses, reload: reloadExpenses } = useCommunityData<Expense[]>('/community/expenses');
  const { data: me } = useCommunityData<Me>('/community/me');
  const canManage = me?.memberships?.[0]?.role !== 'member';

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      const amount = parseFloat(form.amount);
      if (!form.label.trim() || Number.isNaN(amount) || amount <= 0 || !form.spentOn) {
        throw new Error(t('community.accounts.validationError'));
      }
      await communityApi.post('/community/expenses', {
        label: form.label,
        amount,
        category: form.category || undefined,
        spentOn: form.spentOn,
        notes: form.notes || undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      reloadExpenses();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('community.accounts.couldNotAdd'));
    } finally {
      setBusy(false);
    }
  }

  async function removeExpense(id: string) {
    if (!confirm(t('community.accounts.confirmRemove'))) return;
    setActionId(id);
    try {
      await communityApi.delete(`/community/expenses/${id}`);
      reloadExpenses();
    } finally {
      setActionId(null);
    }
  }

  return (
    <CommunityPageFrame
      title={t('community.accounts.title')}
      subtitle={t('community.accounts.subtitle')}
      action={canManage ? <Button onClick={() => setShowForm((s) => !s)}>{showForm ? t('common.cancel') : t('community.accounts.logExpense')}</Button> : undefined}
      loading={loading}
      error={error}
    >
      <div className="flex flex-col gap-6">
        {summary && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 pt-6">
                <TrendingUp className="h-6 w-6 text-success-600" />
                <div>
                  <p className="text-xs text-text-secondary">{t('community.accounts.totalCollected')}</p>
                  <p className="text-lg font-bold text-text">₹{summary.totalCollected.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 pt-6">
                <TrendingDown className="h-6 w-6 text-danger-600" />
                <div>
                  <p className="text-xs text-text-secondary">{t('community.accounts.totalSpent')}</p>
                  <p className="text-lg font-bold text-text">₹{summary.totalSpent.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 pt-6">
                <Wallet className="h-6 w-6 text-primary-600" />
                <div>
                  <p className="text-xs text-text-secondary">{t('community.accounts.balance')}</p>
                  <p className="text-lg font-bold text-text">₹{summary.currentBalance.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={addExpense} className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ex-label">{t('community.accounts.label')}</Label>
                    <Input id="ex-label" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder={t('community.accounts.labelPlaceholder')} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ex-amount">{t('community.accounts.amount')}</Label>
                    <Input id="ex-amount" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="2500" inputMode="decimal" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ex-category">{t('community.accounts.categoryOptional')}</Label>
                    <Input id="ex-category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder={t('community.accounts.categoryPlaceholder')} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="ex-date">{t('community.accounts.date')}</Label>
                    <Input id="ex-date" type="date" value={form.spentOn} onChange={(e) => setForm((f) => ({ ...f, spentOn: e.target.value }))} />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ex-notes">{t('community.accounts.notesOptional')}</Label>
                  <Input id="ex-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
                {formError && <p className="text-sm text-danger-600">{formError}</p>}
                <Button type="submit" disabled={busy} className="self-start">
                  {busy ? t('community.accounts.adding') : t('community.accounts.addExpense')}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {summary && summary.ledger.length > 0 && (
          <Card>
            <CardContent className="overflow-x-auto pt-6">
              <h2 className="mb-3 font-bold text-text">{t('community.accounts.monthlyLedger')}</h2>
              <table className="w-full min-w-[400px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th className="pb-2">{t('community.accounts.month')}</th>
                    <th className="pb-2 text-right">{t('community.accounts.collected')}</th>
                    <th className="pb-2 text-right">{t('community.accounts.spent')}</th>
                    <th className="pb-2 text-right">{t('community.accounts.balance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.ledger.map((row) => (
                    <tr key={row.month} className="border-b border-border last:border-0">
                      <td className="py-2 text-text">{row.month}</td>
                      <td className="py-2 text-right text-success-600">₹{row.collected.toFixed(2)}</td>
                      <td className="py-2 text-right text-danger-600">₹{row.spent.toFixed(2)}</td>
                      <td className="py-2 text-right font-semibold text-text">₹{row.balance.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <div>
          <h2 className="mb-3 font-bold text-text">{t('community.accounts.expenses')}</h2>
          {!expenses || expenses.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-text-secondary">{t('community.accounts.noExpenses')}</CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {expenses.map((ex) => (
                <Card key={ex.id}>
                  <CardContent className="flex items-center gap-4 py-3">
                    <IndianRupee className="h-4 w-4 shrink-0 text-text-secondary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-text">{ex.label}</p>
                      <p className="text-xs text-text-secondary">
                        {ex.category ? `${ex.category} · ` : ''}{new Date(ex.spentOn).toLocaleDateString()} · {ex.addedBy.name}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold text-text">₹{Number(ex.amount).toFixed(2)}</p>
                    {canManage && (
                      <Button size="sm" variant="outline" className="shrink-0 text-danger-600" disabled={actionId === ex.id} onClick={() => removeExpense(ex.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </CommunityPageFrame>
  );
}
