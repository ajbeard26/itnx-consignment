export const PAGE_SIZE = 25;

export function pageNumber(value?: string | number | null) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function paginate(total: number, page: number, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(Math.max(0, total) / size));
  const current = Math.min(Math.max(1, page), pages);
  return {
    current,
    pages,
    total,
    skip: (current - 1) * size,
    take: size,
  };
}
