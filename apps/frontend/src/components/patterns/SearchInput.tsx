import type { ComponentProps } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SearchInputProps extends ComponentProps<'input'> {
  onClear?: () => void;
}

export function SearchInput({ className, value, onClear, ...props }: SearchInputProps) {
  const hasValue = typeof value === 'string' && value.length > 0;

  return (
    <div className={cn('relative w-full', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input value={value} className={cn('pl-8', hasValue && onClear && 'pr-8')} {...props} />
      {hasValue && onClear ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

