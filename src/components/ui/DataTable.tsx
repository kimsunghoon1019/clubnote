"use client";

import { cn } from "@/lib/cn";
import { Fragment, type MouseEvent, type ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: ReactNode;
  width?: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  render: (row: T) => ReactNode;
};

export type DataTableGroup<T> = {
  key: string;
  label?: ReactNode;
  rows: T[];
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  groups,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  selectedIds,
  onToggle,
  onToggleAll,
  empty,
  tableClassName,
}: {
  columns: Column<T>[];
  rows: T[];
  groups?: DataTableGroup<T>[];
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
  onRowClick?: (row: T, event: MouseEvent<HTMLTableRowElement>) => void;
  selectedIds?: string[];
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
  empty?: ReactNode;
  tableClassName?: string;
}) {
  const displayGroups = groups ?? [{ key: "all", rows }];
  const flatRows = displayGroups.flatMap((group) => group.rows);
  const allSelected = Boolean(flatRows.length && selectedIds && flatRows.every((row) => selectedIds.includes(row.id)));
  const someSelected = Boolean(selectedIds && selectedIds.length > 0 && !allSelected);
  const colSpan = columns.length + (onToggle ? 1 : 0);

  const renderRow = (row: T) => {
    const selected = selectedIds?.includes(row.id);
    return (
      <tr
        key={row.id}
        className={cn(
          "border-b border-line-soft text-ink hover:bg-muted",
          selected && "bg-[#F7FBFF]",
          onRowClick && "cursor-pointer",
        )}
        onMouseDown={(event) => {
          if (event.shiftKey || event.ctrlKey || event.metaKey) event.preventDefault();
        }}
        onClick={(event) => onRowClick?.(row, event)}
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
  };

  return (
    <div className="overflow-auto scrollbar-thin">
      <table className={cn("w-full border-collapse text-table", tableClassName ?? "min-w-[760px]")}>
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
                    <span
                      className={cn(
                        "inline-block w-3 text-center text-[10px] leading-none text-brand",
                        sortKey === col.key ? "visible" : "invisible",
                      )}
                    >
                      {sortDir === "asc" ? "▲" : "▼"}
                    </span>
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {flatRows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="px-3 py-16 text-center text-[13px] text-faint">
                {empty ?? "해당하는 항목이 없어요"}
              </td>
            </tr>
          ) : (
            displayGroups.map((group) => (
              <Fragment key={group.key}>
                {group.label ? (
                  <tr className="border-y border-line bg-muted">
                    <td colSpan={colSpan} className="px-3 py-2 text-[12px] font-semibold text-sub">
                      {group.label}
                    </td>
                  </tr>
                ) : null}
                {group.rows.map(renderRow)}
              </Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
