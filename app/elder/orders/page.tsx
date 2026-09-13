'use client';

import { useLanguage } from '@/lib/i18n/language-context';
import { t as translate, type TranslationKey } from '@/lib/i18n/dictionary';
import { OrdersList } from '@/components/orders-list';

export default function ElderOrdersPage() {
  const lang = useLanguage();
  const t = (key: TranslationKey) => translate(key, lang?.language ?? 'en');

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">{t('elder.orders.title')}</h1>
      <p className="mt-1 text-text-secondary">{t('elder.orders.subtitle')}</p>

      <div className="mt-6">
        <OrdersList />
      </div>
    </div>
  );
}
