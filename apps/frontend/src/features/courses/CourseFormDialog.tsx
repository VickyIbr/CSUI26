import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormDialog } from '@/components/patterns/FormDialog';
import { TextAreaField, TextField } from '@/components/patterns/TextField';
import { courseFormSchema, type CourseFormValues } from '@/features/courses/schema';
import type { CourseRow, ProgramOption } from '@/features/courses/types';

function toFormValues(row: CourseRow | null, programs: ProgramOption[]): CourseFormValues {
  if (!row) {
    return {
      programId: programs[0]?.id ?? '',
      semester: '1',
      name: '',
      code: '',
      sks: 3,
      description: '',
    };
  }
  return {
    programId: row.programId,
    semester: String(row.semester),
    name: row.course.name,
    code: row.course.code ?? '',
    sks: row.course.sks,
    description: row.course.description ?? '',
  };
}

interface CourseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: CourseRow | null;
  programs: ProgramOption[];
  saving: boolean;
  onSubmit: (values: CourseFormValues) => void;
}

export function CourseFormDialog({
  open,
  onOpenChange,
  editing,
  programs,
  saving,
  onSubmit,
}: CourseFormDialogProps) {
  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: toFormValues(editing, programs),
  });
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (open) reset(toFormValues(editing, programs));
  }, [open, editing, programs, reset]);

  const programItems: Record<string, string> = {};
  for (const program of programs) programItems[program.id] = program.name;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit course' : 'Add course'}
      description="Select the study program, semester, and course details."
      onSubmit={handleSubmit(onSubmit)}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {editing ? 'Save changes' : 'Add course'}
          </Button>
        </>
      }
    >
      <FieldGroup className="gap-4">
        <Field data-invalid={Boolean(errors.programId)}>
          <FieldLabel htmlFor="course-program">Study program</FieldLabel>
          <Controller
            control={control}
            name="programId"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
              >
                <SelectTrigger
                  id="course-program"
                  className="w-full"
                  aria-invalid={Boolean(errors.programId)}
                  aria-describedby={errors.programId ? 'course-program-error' : undefined}
                >
                  <SelectValue placeholder="Select study program">
                    {programItems[field.value] ?? field.value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.programId ? (
            <FieldError id="course-program-error">{errors.programId.message}</FieldError>
          ) : null}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="course-semester"
            label="Semester"
            inputMode="numeric"
            error={errors.semester?.message}
            {...register('semester')}
          />
          <TextField
            id="course-sks"
            label="SKS"
            type="number"
            min={1}
            max={6}
            error={errors.sks?.message}
            {...register('sks', { valueAsNumber: true })}
          />
        </div>

        <TextField
          id="course-name"
          label="Course name"
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          id="course-code"
          label="Code"
          hint="Optional, e.g. DDP 1."
          error={errors.code?.message}
          {...register('code')}
        />
        <TextAreaField
          id="course-description"
          label="Description"
          rows={3}
          error={errors.description?.message}
          {...register('description')}
        />
      </FieldGroup>
    </FormDialog>
  );
}

