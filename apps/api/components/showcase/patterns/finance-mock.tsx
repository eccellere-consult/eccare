import { ArrowDownLeft, ArrowUpRight, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MockFrame } from '../showcase-shell';

export function FinanceMock({
  balance,
  transactions,
}: {
  balance: string;
  transactions: { name: string; amount: string; in: boolean }[];
}) {
  return (
    <MockFrame>
      <div className="rounded-2xl bg-primary-600 p-6 text-white">
        <p className="text-sm opacity-80">Available balance</p>
        <p className="mt-1 text-3xl font-black">{balance}</p>
        <Button variant="accent" size="sm" className="mt-4">
          <Send className="h-4 w-4" />
          Request money from family
        </Button>
      </div>
      <div className="mt-6 flex flex-col gap-3">
        {transactions.map((t) => (
          <div key={t.name} className="flex items-center gap-4 rounded-2xl border border-border bg-bg p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${t.in ? 'bg-success-50 text-success-600' : 'bg-primary-50 text-primary-600'}`}>
              {t.in ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
            </div>
            <p className="flex-1 font-semibold text-text">{t.name}</p>
            <p className={`font-bold ${t.in ? 'text-success-600' : 'text-text'}`}>{t.amount}</p>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}
