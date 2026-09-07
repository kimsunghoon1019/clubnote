"use client";

import { cn } from "@/lib/cn";
import { Fragment, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: ReactNode;
  width?: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  className?: string;
  render: (row: T) => ReactNode;
};

export type DataTableGroup<T> = {
  key: string;
  label?: ReactNode;
  rows: T[];
};

const CHECK_COL_PX = 40;
const MIN_COL_PX = 56;

function parsePx(width?: string) {
  if (!width) return undefined;
  const n = Number.parseFloat(width);
  return Number.isFinite(n) ? n : undefined;
}

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
  resizable = false,
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
  resizable?: boolean;
}) {
  const displayGroups = groups ?? [{ key: "all", rows }];
  const flatRows = displayGroups.flatMap((group) => group.rows);
  const allSelected = Boolean(flatRows.length && selectedIds && flatRows.every((row) => selectedIds.includes(row.id)));
  const someSelected = Boolean(selectedIds && selectedIds.length > 0 && !allSelected);
  const colSpan = columns.length + (onToggle ? 1 : 0);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [resizing, setResizing] = useState<string | null>(null);
  const draggingRef = useRef(false);

  const widthOf = (key: string, fallback?: string) => colWidths[key] ?? parsePx(fallback) ?? 120;
  const tablePx = (onToggle ? CHECK_COL_PX : 0) + columns.reduce((sum, col) => sum + widthOf(col.key, col.width), 0);

  function startResize(key: string, fallback: string | undefined, event: { button: number; clientX: number; preventDefault: () => void; stopPropagation: () => void }) {
    if (event.button !== 0 || draggingRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    draggingRef.current = true;
    const startX = event.clientX;
    const startW = widthOf(key, fallback);
    setResizing(key);
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const apply = (clientX: number) => {
      const next = Math.max(MIN_COL_PX, Math.round(startW + clientX - startX));
      setColWidths((prev) => (prev[key] === next ? prev : { ...prev, [key]: next }));
    };
    const onMove = (ev: globalThis.PointerEvent) => apply(ev.clientX);
    const onMouse = (ev: globalThis.MouseEvent) => apply(ev.clientX);
    const onUp = () => {
      draggingRef.current = false;
      setResizing(null);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("mousemove", onMouse);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("mouseup", onUp);
  }

  const cellStyle = (col: Column<T>) => {
    if (resizable) {
      const px = widthOf(col.key, col.width);
      return { width: px, minWidth: px, maxWidth: px };
    }
    return col.width ? { width: col.width, minWidth: col.width, maxWidth: col.width } : undefined;
  };

  const renderRow = (row: T) => {
    const selected = selectedIds?.includes(row.id);
    return (
      <tr
        key={row.id}
        data-row-id={row.id}
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
              (col.width || resizable) && "overflow-hidden text-ellipsis",
              col.className,
            )}
            style={cellStyle(col)}
          >
            {col.render(row)}
          </td>
        ))}
      </tr>
    );
  };

  return (
    <div className="overflow-auto scrollbar-thin">
      <table
        className={cn(
          "border-collapse text-table",
          resizable ? "table-fixed" : "w-full",
          !resizable && (tableClassName ?? "min-w-[760px]"),
          resizable && tableClassName,
          resizing && "select-none",
        )}
        style={resizable ? { width: tablePx, minWidth: tablePx } : undefined}
        data-table-layout={resizable ? "fixed" : "auto"}
        data-col-resizing={resizing ?? undefined}
      >
        {resizable ? (
          <colgroup>
            {onToggle ? <col style={{ width: CHECK_COL_PX }} /> : null}
            {columns.map((col) => {
              const px = widthOf(col.key, col.width);
              return <col key={col.key} style={{ width: px }} />;
            })}
          </colgroup>
        ) : null}
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
                data-col-key={col.key}
                data-col-width={resizable ? String(widthOf(col.key, col.width)) : undefined}
                className={cn(
                  "relative whitespace-nowrap px-3 py-2 font-medium",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  col.align !== "right" && col.align !== "center" && "text-left",
                  (col.width || resizable) && "overflow-hidden",
                  col.className,
                )}
                style={cellStyle(col)}
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
                {resizable ? (
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`${typeof col.header === "string" ? col.header : col.key} 열 너비 조절`}
                    data-col-resize={col.key}
                    className={cn(
                      "absolute top-0 right-0 z-30 h-full w-3 translate-x-1/2 cursor-col-resize touch-none hover:bg-brand/45",
                      resizing === col.key && "bg-brand/60",
                    )}
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => startResize(col.key, col.width, event)}
                    onMouseDown={(event) => startResize(col.key, col.width, event)}
                  />
                ) : null}
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
