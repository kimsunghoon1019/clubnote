"use client";

import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: ReactNode;
  width?: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  render: (row: T) => ReactNode;
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  selectedIds,
  onToggle,
  onToggleAll,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  selectedIds?: string[];
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
  empty?: ReactNode;
}) {
  const allSelected = Boolean(rows.length && selectedIds && rows.every((row) => selectedIds.includes(row.id)));
  const someSelected = Boolean(selectedIds && selectedIds.length > 0 && !allSelected);

  return (
    <div className="overflow-auto scrollbar-thin">
      <table className="w-full min-w-[760px] border-collapse text-table">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="border-b border-line-soft text-faint">
            {onToggle ? (
              <th scope="col" className="w-10 px-3 py-2 text-left font-medium">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={onToggleAll}
                  aria-label="전체 선택"
                  className="h-3.5 w-3.5 accent-brand"
                />
              </th>
            ) : null}
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "whitespace-nowrap px-3 py-2 font-medium",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  col.align !== "right" && col.align !== "center" && "text-left",
                )}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.sortable && onSort ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-ink"
                    onClick={() => onSort(col.key)}
                  >
                    {col.header}
                    {sortKey === col.key ? (
                      <span className="text-[10px] text-brand">{sortDir === "asc" ? "▲" : "▼"}</span>
                    ) : null}
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (onToggle ? 1 : 0)} className="px-3 py-16 text-center text-[13px] text-faint">
                {empty ?? "해당하는 항목이 없어요"}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const selected = selectedIds?.includes(row.id);
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-line-soft text-ink hover:bg-muted",
                    selected && "bg-[#F7FBFF]",
                    onRowClick && "cursor-pointer",
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {onToggle ? (
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={Boolean(selected)}
                        onChange={() => onToggle(row.id)}
                        aria-label="행 선택"
                        className="h-3.5 w-3.5 accent-brand"
                      />
                    </td>
                  ) : null}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "whitespace-nowrap px-3 py-[9px]",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
