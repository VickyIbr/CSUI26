import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { FormDialog } from '@/components/patterns/FormDialog';
import { TextAreaField, TextField } from '@/components/patterns/TextField';
import { programFormSchema, type ProgramFormValues } from '@/features/programs/schema';
import type { Program } from '@/features/programs/types';

const emptyValues: ProgramFormValues = {
  id: '',
  name: '',
  slug: '',
  description: '',
  careers: '',
  courseMapUrl: '',
  driveUrl: '',
};

function toFormValues(program: Program | null): ProgramFormValues {
  if (!program) return { ...emptyValues };
  return {
    id: program.id,
    name: program.name,
    slug: program.slug,
    description: program.description,
    careers: program.careers.join(', '),
    courseMapUrl: program.courseMapUrl,
    driveUrl: program.driveUrl,
  };
}

interface ProgramFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Program | null;
  saving: boolean;
  onSubmit: (values: ProgramFormValues) => void;
}

export function ProgramFormDialog({
  open,
  onOpenChange,
  editing,
  saving,
  onSubmit,
}: ProgramFormDialogProps) {
  const form = useForm<ProgramFormValues>({
    resolver: zodResolver(programFormSchema),
    defaultValues: toFormValues(editing),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (open) reset(toFormValues(editing));
  }, [open, editing, reset]);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit study program' : 'Add study program'}
      description="Program data is used to group courses and public pages."
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
            {editing ? 'Save perubahan' : 'Add program'}
          </Button>
        </>
      }
    >
      <FieldGroup className="gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="program-id"
            label="ID"
            placeholder="ilmu-komputer"
            error={errors.id?.message}
            disabled={Boolean(editing)}
            {...register('id')}
          />
          <TextField
            id="program-slug"
            label="Slug"
            placeholder="ilmu-komputer"
            error={errors.slug?.message}
            {...register('slug')}
          />
        </div>
        <TextField
          id="program-name"
          label="Name"
          placeholder="Ilmu Komputer"
          error={errors.name?.message}
          {...register('name')}
        />
        <TextAreaField
          id="program-description"
          label="Description"
          error={errors.description?.message}
          rows={3}
          {...register('description')}
        />
        <TextField
          id="program-careers"
          label="Prospek karier"
          hint="Separate with commas."
          error={errors.careers?.message}
          {...register('careers')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="program-course-map"
            label="Course map URL"
            placeholder="https://"
            error={errors.courseMapUrl?.message}
            {...register('courseMapUrl')}
          />
          <TextField
            id="program-drive"
            label="Drive URL"
            placeholder="https://"
            error={errors.driveUrl?.message}
            {...register('driveUrl')}
          />
        </div>
      </FieldGroup>
    </FormDialog>
  );
}


