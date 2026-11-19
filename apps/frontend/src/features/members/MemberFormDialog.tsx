import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormDialog } from '@/components/patterns/FormDialog';
import { ImageUploadEditor, type ImageUploadValue } from '@/components/patterns/ImageUploadEditor';
import { TextAreaField, TextField } from '@/components/patterns/TextField';
import { SocialLinkField } from '@/features/members/SocialLinkField';
import { normalizeSocialLink } from '@/features/members/socialLinks';
import { memberFormSchema, type MemberFormValues } from '@/features/members/schema';
import type { Member } from '@/features/members/types';
import { membersApi } from '@/features/members/api';
import { programsApi } from '@/features/programs/api';
import type { Program } from '@/features/programs/types';
import { toast } from 'sonner';

const emptyValues: MemberFormValues = {
  npm: '',
  email: '',
  name: '',
  nama_panggilan: '',
  programId: '',
  niche: '',
  deskripsi: '',
  quotes: '',
  instagram: '',
  line: '',
  github: '',
  linkedin: '',
  fotoUrl: '',
  fotoConfig: undefined,
};

function toFormValues(member: Member | null): MemberFormValues {
  if (!member) return { ...emptyValues };
  return {
    npm: member.npm,
    email: member.email,
    name: member.name,
    nama_panggilan: member.nama_panggilan,
    programId: member.programId,
    niche: member.niche,
    deskripsi: member.deskripsi,
    quotes: member.quotes,
    instagram: member.instagram,
    line: member.line,
    github: member.github,
    linkedin: member.linkedin,
    fotoUrl: member.foto.url,
    fotoConfig: member.foto.config,
  };
}

interface MemberFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Member | null;
  saving: boolean;
  isAdmin?: boolean;
  onDelete?: (member: Member) => void;
  onPhotoSaved?: (member: Member) => void;
  onSubmit: (values: MemberFormValues) => void;
}

export function MemberFormDialog({
  open,
  onOpenChange,
  editing,
  saving,
  isAdmin = false,
  onDelete,
  onPhotoSaved,
  onSubmit,
}: MemberFormDialogProps) {
  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: toFormValues(editing),
  });

  const [roleValue, setRoleValue] = useState<string>(editing?.role || 'user');
  const [savingRole, setSavingRole] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);

  useEffect(() => {
    if (!open) return;
    programsApi.list().then((res) => setPrograms(res.data)).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (open && editing) {
      setRoleValue(editing.role || 'user');
    }
  }, [open, editing]);

  const handleRoleChange = async (newRole: string) => {
    if (!editing || !isAdmin) return;
    setSavingRole(true);
    try {
      await membersApi.updateRole(editing.npm, newRole as 'user' | 'admin');
      setRoleValue(newRole);
      toast.success(`Role changed to ${newRole}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change role');
    } finally {
      setSavingRole(false);
    }
  };
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
      title={editing ? 'Edit member' : 'Add member'}
      description="NPM is used as the primary identity and cannot be changed after saving."
      onSubmit={handleSubmit(onSubmit)}
      className="sm:max-w-2xl"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <div>
            {editing && isAdmin && onDelete ? (
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
              {editing ? 'Save changes' : 'Add member'}
            </Button>
          </div>
        </div>
      }
    >
      <FieldGroup className="gap-4">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Identity</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="member-npm"
              label="NPM"
              inputMode="numeric"
              hint="10 digit number."
              error={errors.npm?.message}
              disabled={Boolean(editing)}
              {...register('npm')}
            />
            <TextField
              id="member-email"
              label="Email"
              type="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <TextField
              id="member-name"
              label="Full name"
              error={errors.name?.message}
              {...register('name')}
            />
            <TextField
              id="member-nickname"
              label="Nickname"
              error={errors.nama_panggilan?.message}
              {...register('nama_panggilan')}
            />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Academic</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="member-major">Study program</label>
              <Select
                value={form.watch('programId') || ''}
                onValueChange={(value) => form.setValue('programId', value ?? '', { shouldValidate: true })}
              >
                <SelectTrigger id="member-major">
                  <SelectValue placeholder="Select study program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.programId?.message ? (
                <p className="text-sm text-destructive">{errors.programId.message}</p>
              ) : null}
            </div>
            <TextField
              id="member-niche"
              label="Niche"
              hint="Optional."
              error={errors.niche?.message}
              {...register('niche')}
            />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Profile content</h3>
          <TextAreaField
            id="member-description"
            label="Description"
            rows={3}
            error={errors.deskripsi?.message}
            {...register('deskripsi')}
          />
          <TextAreaField
            id="member-quotes"
            label="Quote"
            rows={2}
            error={errors.quotes?.message}
            {...register('quotes')}
          />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Social links</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <SocialLinkField
              id="member-instagram"
              label="Instagram"
              platform="instagram"
              value={form.watch('instagram') ?? ''}
              onChange={(value) => form.setValue('instagram', value, { shouldValidate: true })}
              error={errors.instagram?.message}
              hint="Username or profile URL."
            />
            <SocialLinkField
              id="member-line"
              label="LINE"
              platform="line"
              value={form.watch('line') ?? ''}
              onChange={(value) => form.setValue('line', value, { shouldValidate: true })}
              error={errors.line?.message}
            />
            <SocialLinkField
              id="member-github"
              label="GitHub"
              platform="github"
              value={form.watch('github') ?? ''}
              onChange={(value) => form.setValue('github', value, { shouldValidate: true })}
              error={errors.github?.message}
            />
            <SocialLinkField
              id="member-linkedin"
              label="LinkedIn"
              platform="linkedin"
              value={form.watch('linkedin') ?? ''}
              onChange={(value) => form.setValue('linkedin', value, { shouldValidate: true })}
              error={errors.linkedin?.message}
            />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Media</h3>
          <ImageUploadEditor
            endpoint="/upload/avatar"
            uploadParams={editing?.npm ? { npm: editing.npm } : undefined}
            value={{ url: form.watch('fotoUrl') ?? '', config: form.watch('fotoConfig') }}
            onChange={({ url, config }) => {
              form.setValue('fotoUrl', url, { shouldValidate: true });
              form.setValue('fotoConfig', config);
            }}
            onCommit={
              editing
                ? async (next: ImageUploadValue) => {
                    const foto: ImageUploadValue = {
                      url: normalizeSocialLink('photo', next.url),
                      config: next.config,
                    };
                    const res = await membersApi.update(editing.npm, { foto });
                    const saved = res.data;
                    form.setValue('fotoUrl', saved.foto.url, { shouldValidate: true });
                    form.setValue('fotoConfig', saved.foto.config);
                    window.dispatchEvent(
                      new CustomEvent('zenith:profile-updated', {
                        detail: { npm: saved.npm, fotoUrl: saved.foto.url },
                      }),
                    );
                    onPhotoSaved?.(saved);
                    toast.success('Member photo saved');
                  }
                : undefined
            }
          />
          {errors.fotoUrl?.message ? (
            <p className="text-xs text-destructive">{errors.fotoUrl.message}</p>
          ) : null}
        </div>
      </FieldGroup>

      {isAdmin && editing ? (
        <div className="space-y-2 border-t pt-4">
          <label className="text-sm font-medium" htmlFor="member-role">Edit Role</label>
          <Select
            value={roleValue}
            onValueChange={handleRoleChange}
            disabled={savingRole}
          >
            <SelectTrigger id="member-role" className="w-full">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </FormDialog>
  );
}






