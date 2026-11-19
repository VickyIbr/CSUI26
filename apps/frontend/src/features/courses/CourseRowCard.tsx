import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { CourseRow } from '@/features/courses/types';

interface CourseRowCardProps {
  row: CourseRow;
  onEdit: (row: CourseRow) => void;
  onDelete: (row: CourseRow) => void;
}

export function CourseRowCard({ row, onEdit, onDelete }: CourseRowCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-foreground">{row.course.name}</h3>
            {row.course.code ? <Badge variant="secondary">{row.course.code}</Badge> : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {row.programName} · Semester {row.semester} · {row.course.sks} SKS
          </p>
          {row.course.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{row.course.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(row)}
            aria-label={`Edit ${row.course.name}`}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(row)}
            aria-label={`Delete ${row.course.name}`}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
