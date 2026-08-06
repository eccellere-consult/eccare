import { getServerSession } from '@/lib/server-session';
import { PaymentsDue } from '@/components/payments-due';

export const dynamic = 'force-dynamic';

export default async function ElderPaymentsPage() {
  const session = await getServerSession();

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Payments</h1>
      <p className="mt-1 text-text-secondary">Association fees for your home.</p>
      <div className="mt-6">
        {session && <PaymentsDue elderUserId={session.userId} />}
      </div>
    </div>
  );
}
