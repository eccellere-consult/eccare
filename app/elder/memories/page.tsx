import { getServerSession } from '@/lib/server-session';
import { MemoriesGallery } from '@/components/memories-gallery';

export const dynamic = 'force-dynamic';

export default async function ElderMemoriesPage() {
  const session = await getServerSession();

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Memories</h1>
      <p className="mt-1 text-text-secondary">Photos shared with your family. Just the two of you can see these.</p>
      <div className="mt-6">
        {session && <MemoriesGallery elderUserId={session.userId} />}
      </div>
    </div>
  );
}
