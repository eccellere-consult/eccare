import { getServerUser } from '@/lib/server-session';
import { PaymentsDue } from '@/components/payments-due';
import { t as translate } from '@/lib/i18n/dictionary';

export const dynamic = 'force-dynamic';

export default async function ElderPaymentsPage() {
  const user = await getServerUser();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, user?.language ?? 'en');

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">{t('elder.payments.title')}</h1>
      <p className="mt-1 text-text-secondary">{t('elder.payments.subtitle')}</p>
      <div className="mt-6">
        {user && <PaymentsDue elderUserId={user.id} />}
      </div>
    </div>
  );
}
