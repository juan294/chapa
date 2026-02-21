// ---------------------------------------------------------------------------
// AdminSearchBar — search/filter input for the admin user table
// ---------------------------------------------------------------------------

interface AdminSearchBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  resultCount: number;
}

export function AdminSearchBar({ search, onSearchChange, resultCount }: AdminSearchBarProps) {
  return (
    <div className="border-b border-stroke px-4 py-3 flex items-center gap-3">
      <span className="font-heading text-sm text-amber" aria-hidden="true">
        &gt;
      </span>
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="filter by handle or name..."
        className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary/50 font-heading outline-none focus-visible:ring-2 focus-visible:ring-amber"
        aria-label="Filter users"
      />
      {search && (
        <span className="text-xs text-text-secondary tabular-nums">
          {resultCount} result{resultCount !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
