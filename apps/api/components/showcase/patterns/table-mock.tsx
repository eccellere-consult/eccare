import { Badge } from '@/components/ui/badge';
import { MockFrame } from '../showcase-shell';

export function TableMock({
  columns,
  rows,
}: {
  columns: string[];
  rows: { cells: string[]; badge?: { label: string; variant?: 'default' | 'success' | 'accent' | 'danger' | 'muted' } }[];
}) {
  return (
    <MockFrame className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-text-secondary">
              {columns.map((col) => (
                <th key={col} className="px-6 py-4 font-semibold">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                {row.cells.map((cell, j) => (
                  <td key={j} className="px-6 py-4 text-text">
                    {j === 0 ? <span className="font-semibold">{cell}</span> : cell}
                  </td>
                ))}
                {row.badge && (
                  <td className="px-6 py-4">
                    <Badge variant={row.badge.variant ?? 'default'}>{row.badge.label}</Badge>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MockFrame>
  );
}
