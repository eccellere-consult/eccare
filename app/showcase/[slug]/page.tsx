import { notFound } from 'next/navigation';
import { SHOWCASE_FEATURES, ICON_MAP } from '@/lib/showcase-data';
import { ShowcaseShell } from '@/components/showcase/showcase-shell';
import { TileGridMock } from '@/components/showcase/patterns/tile-grid-mock';
import { SosMock } from '@/components/showcase/patterns/sos-mock';
import { ContactListMock } from '@/components/showcase/patterns/contact-list-mock';
import { ItemListMock } from '@/components/showcase/patterns/item-list-mock';
import { TableMock } from '@/components/showcase/patterns/table-mock';
import { DirectoryMock } from '@/components/showcase/patterns/directory-mock';
import { ChatMock } from '@/components/showcase/patterns/chat-mock';
import { CalendarMock } from '@/components/showcase/patterns/calendar-mock';
import { StatsMock } from '@/components/showcase/patterns/stats-mock';
import { DeepLinkMock } from '@/components/showcase/patterns/deep-link-mock';
import { VoiceMock } from '@/components/showcase/patterns/voice-mock';
import { PhoneFrameMock } from '@/components/showcase/patterns/phone-frame-mock';
import { ToggleGridMock } from '@/components/showcase/patterns/toggle-grid-mock';
import { MediaMock } from '@/components/showcase/patterns/media-mock';
import { FinanceMock } from '@/components/showcase/patterns/finance-mock';
import { ChecklistMock } from '@/components/showcase/patterns/checklist-mock';
import { QueueMock } from '@/components/showcase/patterns/queue-mock';

export const dynamicParams = false;

export function generateStaticParams() {
  return SHOWCASE_FEATURES.map((f) => ({ slug: f.slug }));
}

type IconName = keyof typeof ICON_MAP;

function resolveIcons(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(resolveIcons);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, val]) => {
      if (key === 'icon' && typeof val === 'string') {
        return [key, ICON_MAP[val as IconName]];
      }
      return [key, resolveIcons(val)];
    });
    return Object.fromEntries(entries);
  }
  return value;
}

const PATTERN_COMPONENTS: Record<string, React.ComponentType<any>> = {
  'tile-grid': TileGridMock,
  sos: SosMock,
  'contact-list': ContactListMock,
  'item-list': ItemListMock,
  table: TableMock,
  directory: DirectoryMock,
  chat: ChatMock,
  calendar: CalendarMock,
  stats: StatsMock,
  'deep-link': DeepLinkMock,
  voice: VoiceMock,
  'phone-frame': PhoneFrameMock,
  'toggle-grid': ToggleGridMock,
  media: MediaMock,
  finance: FinanceMock,
  checklist: ChecklistMock,
  queue: QueueMock,
};

export default async function ShowcaseFeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const feature = SHOWCASE_FEATURES.find((f) => f.slug === slug);
  if (!feature) notFound();

  const PatternComponent = PATTERN_COMPONENTS[feature.pattern];
  const resolvedProps = resolveIcons(feature.props) as Record<string, unknown>;

  return (
    <ShowcaseShell
      featureNumber={feature.number}
      phase={feature.phase}
      title={feature.title}
      tagline={feature.tagline}
      description={feature.description}
      status={feature.status}
    >
      {PatternComponent && <PatternComponent {...resolvedProps} />}
    </ShowcaseShell>
  );
}
