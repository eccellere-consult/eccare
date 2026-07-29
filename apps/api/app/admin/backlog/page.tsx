import { prisma } from '@/lib/db';
import { KanbanBoard } from './kanban-board';

export const dynamic = 'force-dynamic';

export default async function AdminBacklogPage() {
  const items = await prisma.backlogItem.findMany({ orderBy: [{ status: 'asc' }, { position: 'asc' }] });

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Backlog</h1>
      <p className="mt-1 text-text-secondary">Drag cards between columns to update status.</p>
      <div className="mt-6">
        <KanbanBoard initialItems={items} />
      </div>
    </div>
  );
}
