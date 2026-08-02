import { AppShell } from '@/components/app-shell';
import { getServerUser } from '@/lib/server-session';
import { LanguageProvider } from '@/lib/i18n/language-context';

export default async function ElderLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();

  return (
    <LanguageProvider
      language={user?.language ?? 'en'}
      secondaryLanguage={user?.secondaryLanguage ?? null}
    >
      <AppShell role="elder" userName={user?.name}>
        {children}
      </AppShell>
    </LanguageProvider>
  );
}
