"use client";

import { cx } from "../ui/Primitives";
import { IconChevronRight } from "../ui/Icons";
import { formatNumber } from "../../lib/format";
import type { Pagination } from "../../lib/types";

/** Page numbers with ellipses, always showing first, last and the neighbours. */
function pageItems(current: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const items: (number | "gap")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);

  if (start > 2) items.push("gap");
  for (let page = start; page <= end; page++) items.push(page);
  if (end < totalPages - 1) items.push("gap");
  items.push(totalPages);
  return items;
}

export function TablePagination({
  pagination,
  onPageChange,
  itemLabel = "users",
}: {
  pagination: Pagination;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}) {
  const { page, pageSize, total, totalPages } = pagination;
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="text-[12px] text-dim">
        {total === 0
          ? "No results"
          : `Showing ${formatNumber(first)} to ${formatNumber(last)} of ${formatNumber(total)} ${itemLabel}`}
      </p>

      <nav aria-label="Pagination" className="flex items-center gap-1">
        <PageButton
          label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <IconChevronRight size={14} className="rotate-180" />
        </PageButton>

        {pageItems(page, totalPages).map((item, index) =>
          item === "gap" ? (
            <span key={`gap-${index}`} className="px-1.5 text-[12px] text-faint">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              aria-current={item === page ? "page" : undefined}
              onClick={() => onPageChange(item)}
              className={cx(
                "grid h-8 min-w-8 place-items-center rounded-[8px] px-2 text-[12px] font-semibold transition-colors",
                item === page
                  ? "bg-blue text-white"
                  : "border border-line text-muted hover:border-panel-3 hover:text-fg",
              )}
            >
              {formatNumber(item)}
            </button>
          ),
        )}

        <PageButton
          label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <IconChevronRight size={14} />
        </PageButton>
      </nav>
    </div>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-[8px] border border-line text-muted transition-colors hover:border-panel-3 hover:text-fg disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}
