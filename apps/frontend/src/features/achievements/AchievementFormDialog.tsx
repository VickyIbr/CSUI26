import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Trash2 } from 'lucide-react';
import type { Achievement } from '@zenith/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { FormDialog } from '@/components/patterns/FormDialog';
import { ImageUploadEditor, type ImageUploadValue } from '@/components/patterns/ImageUploadEditor';
import { TextAreaField, TextField } from '@/components/patterns/TextField';
import { achievementsApi } from '@/features/achievements/api';
import {
  achievementFormSchema,
  type AchievementFormValues,
} from '@/features/achievements/schema';
import { normalizeSocialLink } from '@/features/members/socialLinks';

function createEmptyValues(): AchievementFormValues {
  return {
    id: '',
    title: '',
    year: new Date().getFullYear(),
    isFeatured: false,
    award: '',
    teamName: '',
    membersText: '',
    description: '',
    showOverlay: true,
    imageUrl: '',
    imageConfig: undefined,
  };
}

function toFormValues(achievement: Achievement | null): AchievementFormValues {
  if (!achievement) return createEmptyValues();
  return {
    id: achievement.id,
    title: achievement.title,
    year: achievement.year,
    isFeatured: achievement.isFeatured,
    award: achievement.award ?? '',
    teamName: achievement.teamName ?? '',
    membersText: (achievement.members ?? []).join(', '),
    description: achievement.description ?? '',
    showOverlay: achievement.showOverlay ?? true,
    imageUrl: achievement.image?.url ?? '',
    imageConfig: achievement.image?.config,
  };
}

interface AchievementFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Achievement | null;
  saving: boolean;
  onDelete?: (achievement: Achievement) => void;
  onImageSaved?: () => void;
  onSubmit: (values: AchievementFormValues) => void;
}

export function AchievementFormDialog({
  open,
  onOpenChange,
  editing,
  saving,
  onDelete,
  onImageSaved,
  onSubmit,
}: AchievementFormDialogProps) {
  const form = useForm<AchievementFormValues>({
    resolver: zodResolver(achievementFormSchema),
    defaultValues: toFormValues(editing),
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = form;

  const isFeatured = useWatch({ control, name: 'isFeatured' });
  const slugId = useWatch({ control, name: 'id' });
  const imageUrl = useWatch({ control, name: 'imageUrl' });
  const imageConfig = useWatch({ control, name: 'imageConfig' });

  useEffect(() => {
    if (open) reset(toFormValues(editing));
  }, [open, editing, reset]);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit achievement' : 'Add achievement'}
      description="Featured items require a banner image, team details, and summary."
      onSubmit={handleSubmit(onSubmit)}
      className="sm:max-w-2xl"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <div>
            {editing && onDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => onDelete(editing)}
                disabled={saving}
              >
                <Trash2 aria-hidden="true" />
                Delete
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
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
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      }
    >
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="achievement-id"
            label="ID"
            placeholder="icpc-2025"
            disabled={Boolean(editing)}
            hint={editing ? 'Primary ID cannot be changed.' : 'Unique identifier slug.'}
            error={errors.id?.message}
            {...register('id')}
          />
          <TextField
            id="achievement-year"
            label="Year"
            type="number"
            min={1990}
            max={2100}
            className="font-mono tabular-nums"
            error={errors.year?.message}
            {...register('year', { valueAsNumber: true })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="achievement-title"
            label="Title"
            placeholder="ICPC Asia Jakarta Regional"
            error={errors.title?.message}
            {...register('title')}
          />
          <TextField
            id="achievement-award"
            label={isFeatured ? 'Award' : 'Award (optional)'}
            placeholder="JUARA 1"
            error={errors.award?.message}
            {...register('award')}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            className="size-4 rounded border-border accent-primary"
            {...register('isFeatured')}
          />
          <span>Featured Showcase item</span>
        </label>

        {isFeatured ? (
          <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="space-y-2">
              <ImageUploadEditor
                endpoint="/upload/achievement"
                uploadParams={slugId?.trim() ? { slug: slugId.trim() } : undefined}
                label="Banner image"
                value={{ url: imageUrl ?? '', config: imageConfig }}
                onChange={({ url, config }) => {
                  setValue('imageUrl', url, { shouldValidate: true });
                  setValue('imageConfig', config);
                }}
                onCommit={
                  editing
                    ? async (next: ImageUploadValue) => {
                        const image: ImageUploadValue = {
                          url: normalizeSocialLink('photo', next.url),
                          config: next.config,
                        };
                        const res = await achievementsApi.update(editing.id, { image });
                        setValue('imageUrl', res.data.image?.url ?? image.url, { shouldValidate: true });
                        setValue('imageConfig', res.data.image?.config ?? image.config);
                        onImageSaved?.();
                        toast.success('Achievement image saved');
                      }
                    : undefined
                }
              />
              {errors.imageUrl?.message ? (
                <p role="alert" className="text-xs text-destructive">
                  {errors.imageUrl.message}
                </p>
              ) : null}
            </div>

            <TextField
              id="achievement-team"
              label="Team name"
              placeholder="Team Zenith"
              error={errors.teamName?.message}
              {...register('teamName')}
            />

            <TextAreaField
              id="achievement-members"
              label="Team members"
              placeholder="Alice IK'24, Bob SI'24"
              hint="Separate member names with commas or new lines."
              rows={3}
              error={errors.membersText?.message}
              {...register('membersText')}
            />

            <TextAreaField
              id="achievement-description"
              label="Description"
              placeholder="Summary of the competition and result."
              rows={3}
              error={errors.description?.message}
              {...register('description')}
            />

            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                className="size-4 rounded border-border accent-primary"
                {...register('showOverlay')}
              />
              <span>Show typography overlay on showcase card</span>
            </label>
          </div>
        ) : null}
      </FieldGroup>
    </FormDialog>
  );
}
