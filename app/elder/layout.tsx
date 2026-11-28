import { AppShell } from '@/components/app-shell';
import { getServerUser } from '@/lib/server-session';
import { getFeatureSwitches } from '@/lib/feature-switches';
import { LanguageProvider } from '@/lib/i18n/language-context';

export default async function ElderLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();

  return (
    <LanguageProvider
      language={user?.language ?? 'en'}
      secondaryLanguage={user?.secondaryLanguage ?? null}
    >
      <AppShell role="elder" userName={user?.name} needsDateOfBirth={!!user && !user.dateOfBirth} features={await getFeatureSwitches()}>
        {children}
      </AppShell>
    </LanguageProvider>
  );
}
