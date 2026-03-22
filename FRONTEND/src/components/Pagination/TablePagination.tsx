type TablePaginationProps = {
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (value: number) => void;
  itemsPerPageOptions?: number[];
};

function createPageItems(totalPages: number, currentPage: number): Array<number | string> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | string> = [1];
  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);

  if (left > 2) items.push("left-ellipsis");
  for (let page = left; page <= right; page += 1) items.push(page);
  if (right < totalPages - 1) items.push("right-ellipsis");

  items.push(totalPages);
  return items;
}

export default function TablePagination({
  totalItems,
  currentPage,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [10, 20, 50, 100],
}: TablePaginationProps) {
  const safeItemsPerPage = Math.max(1, itemsPerPage);
  const totalPages = Math.max(1, Math.ceil(totalItems / safeItemsPerPage));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const from = totalItems === 0 ? 0 : (safeCurrentPage - 1) * safeItemsPerPage + 1;
  const to = totalItems === 0 ? 0 : Math.min(totalItems, safeCurrentPage * safeItemsPerPage);
  const pageItems = createPageItems(totalPages, safeCurrentPage);

  return (
    <div className="flex flex-col items-center justify-center gap-3 border-t border-border-primary pt-4 md:flex-row md:items-center md:justify-between">
      <p className="text-center text-xs text-text-secondary md:text-left">
        Mostrando <span className="font-semibold text-text-primary">{from}</span>-<span className="font-semibold text-text-primary">{to}</span> de <span className="font-semibold text-text-primary">{totalItems}</span> registros
      </p>

      <div className="flex w-full flex-col items-center justify-center space-y-5 md:w-auto md:flex-row md:justify-start md:gap-2 md:space-y-0">
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          Linhas por página
          <select
            value={safeItemsPerPage}
            onChange={(event) => onItemsPerPageChange(Number(event.target.value))}
            className="select-field px-2 py-1 text-xs"
          >
            {itemsPerPageOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2">
          <button
            type="button"
            onClick={() => onPageChange(safeCurrentPage - 1)}
            disabled={safeCurrentPage <= 1}
            className="rounded-lg border border-border-primary bg-bg-light px-2.5 py-1 text-xs font-semibold text-text-secondary transition hover:border-accent/40 hover:text-accent disabled:opacity-60"
          >
            Anterior
          </button>

          {pageItems.map((item) =>
            typeof item === "number" ? (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  item === safeCurrentPage
                    ? "border-accent bg-accent text-white"
                    : "border-border-primary bg-bg-light text-text-secondary hover:border-accent/40 hover:text-accent"
                }`}
              >
                {item}
              </button>
            ) : (
              <span key={item} className="px-1 text-xs text-text-tertiary">
                ...
              </span>
            ),
          )}

          <button
            type="button"
            onClick={() => onPageChange(safeCurrentPage + 1)}
            disabled={safeCurrentPage >= totalPages}
            className="rounded-lg border border-border-primary bg-bg-light px-2.5 py-1 text-xs font-semibold text-text-secondary transition hover:border-accent/40 hover:text-accent disabled:opacity-60"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
