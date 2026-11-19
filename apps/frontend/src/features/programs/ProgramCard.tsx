import { Link } from 'react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Program } from '@/features/programs/types';

interface ProgramCardProps {
  program: Program;
  onEdit: (program: Program) => void;
  onDelete: (program: Program) => void;
}

export function ProgramCard({ program, onEdit, onDelete }: ProgramCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <CardTitle className="truncate text-base">{program.name}</CardTitle>
          <p className="truncate text-xs text-muted-foreground">
            {program.id} Â· {program.slug}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(program)}
            aria-label={`Edit ${program.name}`}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(program)}
            aria-label={`Delete ${program.name}`}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {program.description || 'No description.'}
        </p>
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <Link
            to={`/courses?program=${encodeURIComponent(program.id)}`}
            className="rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            View courses
          </Link>
          <span>{program.semesters.length} semester</span>
        </div>
      </CardContent>
    </Card>
  );
}

