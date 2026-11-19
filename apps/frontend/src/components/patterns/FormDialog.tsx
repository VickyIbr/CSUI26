import { useId, type FormEventHandler, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  footer: ReactNode;
  children: ReactNode;
  className?: string;
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  footer,
  children,
  className,
}: FormDialogProps) {
  const formId = useId();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('flex max-h-[85dvh] flex-col gap-4 overflow-hidden sm:max-w-lg', className)}>
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form id={formId} onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="min-h-0 flex-1 overflow-y-auto px-0.5 py-0.5">{children}</div>
          <DialogFooter className="shrink-0 pt-1">{footer}</DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
