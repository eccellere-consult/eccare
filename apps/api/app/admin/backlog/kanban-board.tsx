'use client';

import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Status = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
type Priority = 'low' | 'medium' | 'high';

interface BacklogItem {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  position: number;
}

const COLUMNS: { key: Status; label: string }[] = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
];

const PRIORITY_VARIANT: Record<Priority, 'muted' | 'accent' | 'danger'> = {
  low: 'muted',
  medium: 'accent',
  high: 'danger',
};

export function KanbanBoard({ initialItems }: { initialItems: BacklogItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<Status | null>(null);
  const [addingTo, setAddingTo] = useState<Status | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [saving, setSaving] = useState(false);

  function itemsFor(status: Status) {
    return items.filter((i) => i.status === status).sort((a, b) => a.position - b.position);
  }

  async function moveItem(id: string, status: Status) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    await fetch(`/api/v1/admin/backlog/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }

  async function handleAdd(status: Status) {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/admin/backlog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, status }),
      });
      const json = await res.json();
      if (json.success) setItems((prev) => [...prev, json.data]);
      setNewTitle('');
      setAddingTo(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/v1/admin/backlog/${id}`, { method: 'DELETE' });
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => (
        <div
          key={col.key}
          className={cn(
            'flex w-72 shrink-0 flex-col gap-3 rounded-2xl bg-primary-50/50 p-3 transition-colors',
            dragOverColumn === col.key && 'bg-primary-50 ring-2 ring-primary-600',
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverColumn(col.key);
          }}
          onDragLeave={() => setDragOverColumn((c) => (c === col.key ? null : c))}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverColumn(null);
            if (draggingId) moveItem(draggingId, col.key);
          }}
        >
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-text">{col.label}</h3>
            <span className="text-xs font-semibold text-text-secondary">{itemsFor(col.key).length}</span>
          </div>

          <div className="flex flex-col gap-2">
            {itemsFor(col.key).map((item) => (
              <Card
                key={item.id}
                draggable
                onDragStart={() => setDraggingId(item.id)}
                onDragEnd={() => setDraggingId(null)}
                className={cn('cursor-grab active:cursor-grabbing', draggingId === item.id && 'opacity-40')}
              >
                <CardContent className="flex flex-col gap-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-text">{item.title}</p>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="shrink-0 text-text-secondary hover:text-danger-600"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {item.description && <p className="text-xs text-text-secondary">{item.description}</p>}
                  <Badge variant={PRIORITY_VARIANT[item.priority]} className="w-fit">
                    {item.priority}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          {addingTo === col.key ? (
            <div className="flex flex-col gap-2">
              <Input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Card title"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd(col.key);
                  if (e.key === 'Escape') setAddingTo(null);
                }}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleAdd(col.key)} disabled={saving}>
                  Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setAddingTo(null); setNewTitle(''); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingTo(col.key)}
              className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold text-text-secondary hover:bg-primary-50"
            >
              <Plus className="h-4 w-4" />
              Add card
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
