import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from '@/components/ui/pagination';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginatorProps {
  page: number;
  totalPages: number;
  total?: number;
  onPageChange: (page: number) => void;
}

function pageNumbers(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages: (number | 'ellipsis')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);

  if (start > 2) pages.push('ellipsis');
  for (let index = start; index <= end; index += 1) pages.push(index);
  if (end < totalPages - 1) pages.push('ellipsis');
  pages.push(totalPages);

  return pages;
}

export function Paginator({ page, totalPages, total, onPageChange }: PaginatorProps) {
  if (totalPages <= 1) return null;
  const totalLabel = typeof total === 'number' ? ' - ' + total + ' items' : '';

  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      <Pagination>
        <PaginationContent className="flex-wrap">
          <PaginationItem>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
          </PaginationItem>

          {pageNumbers(page, totalPages).map((item, index) =>
            item === 'ellipsis' ? (
              <PaginationItem key={`ellipsis-${index}`} className="hidden sm:block">
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <Button
                  type="button"
                  variant={item === page ? 'outline' : 'ghost'}
                  size="icon-sm"
                  aria-current={item === page ? 'page' : undefined}
                  aria-label={`Page ${item}`}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </Button>
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <p className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
        {totalLabel}
      </p>
    </div>
  );
}
