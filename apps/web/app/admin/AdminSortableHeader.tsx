import type { SortField, SortDir } from "./admin-types";

// ---------------------------------------------------------------------------
// SortIcon
// ---------------------------------------------------------------------------

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return (
      <svg className="ml-1 inline h-3 w-3 text-text-secondary/40" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <path d="M6 2v8M3 5l3-3 3 3" />
      </svg>
    );
  }
  return (
    <svg className="ml-1 inline h-3 w-3 text-amber" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      {dir === "asc" ? <path d="M6 2v8M3 5l3-3 3 3" /> : <path d="M6 10V2M3 7l3 3 3-3" />}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// AdminSortableHeader
// ---------------------------------------------------------------------------

const TH_CLASSES =
  "px-3 py-2.5 text-left font-heading text-xs font-medium text-text-secondary uppercase tracking-wider whitespace-nowrap";

const TH_BTN_CLASSES =
  "inline-flex items-center bg-transparent border-none p-0 font-heading text-xs font-medium text-text-secondary uppercase tracking-wider cursor-pointer select-none hover:text-text-primary transition-colors whitespace-nowrap";

interface AdminSortableHeaderProps {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  /** Extra className appended to the header cell (e.g. responsive visibility) */
  className?: string;
}

export function AdminSortableHeader({
  field,
  label,
  sortField,
  sortDir,
  onSort,
  className,
}: AdminSortableHeaderProps) {
  const ariaSortValue: "ascending" | "descending" | "none" =
    sortField !== field ? "none" : sortDir === "asc" ? "ascending" : "descending";

  return (
    <th scope="col" className={className ? `${TH_CLASSES} ${className}` : TH_CLASSES} aria-sort={ariaSortValue}>
      <button type="button" className={TH_BTN_CLASSES} onClick={() => onSort(field)}>
        {label}
        <SortIcon active={sortField === field} dir={sortDir} />
      </button>
    </th>
  );
}

/** Non-sortable header cell (e.g. actions column). */
export function AdminHeaderCell({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <th scope="col" className={className ? `${TH_CLASSES} ${className}` : TH_CLASSES}>
      {children}
    </th>
  );
}
