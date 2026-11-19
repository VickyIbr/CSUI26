import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/patterns/PageHeader';
import { PageContainer } from '@/components/patterns/PageContainer';
import { ImageUploadEditor, type ImageUploadValue } from '@/components/patterns/ImageUploadEditor';
import { useAuth } from '@/features/auth/useAuth';
import { membersApi } from '@/features/members/api';
import { programsApi } from '@/features/programs/api';
import type { Program } from '@/features/programs/types';
import { SocialLinkField } from '@/features/members/SocialLinkField';
import { normalizeMemberSocials, normalizeSocialLink } from '@/features/members/socialLinks';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function MyProfilePage() {
  useDocumentTitle('My Profile');

  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);

  useEffect(() => {
    programsApi.list().then((res) => setPrograms(res.data)).catch(() => {});
  }, []);

  const [form, setForm] = useState({
    name: '',
    nama_panggilan: '',
    email: '',
    programId: '',
    instagram: '',
    line: '',
    github: '',
    linkedin: '',
    deskripsi: '',
    niche: '',
    quotes: '',
    foto: { url: '' } as ImageUploadValue,
  });

  useEffect(() => {
    if (!user?.npm) return;
    let mounted = true;
    membersApi
      .get(user.npm)
      .then((res) => {
        if (mounted && res.data) {
          setForm({
            name: res.data.name ?? '',
            nama_panggilan: res.data.nama_panggilan ?? '',
            email: res.data.email ?? '',
            programId: res.data.programId ?? '',
            instagram: res.data.instagram ?? '',
            line: res.data.line ?? '',
            github: res.data.github ?? '',
            linkedin: res.data.linkedin ?? '',
            deskripsi: res.data.deskripsi ?? '',
            niche: res.data.niche ?? '',
            quotes: res.data.quotes ?? '',
            foto: res.data.foto ?? { url: '' },
          });
        }
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to load profile'));
    return () => { mounted = false; };
  }, [user?.npm]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const emitProfileUpdated = (fotoUrl: string) => {
    if (!user?.npm) return;
    window.dispatchEvent(
      new CustomEvent('zenith:profile-updated', {
        detail: { npm: user.npm, fotoUrl },
      }),
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.npm) return;
    setSaving(true);
    try {
      const normalized = normalizeMemberSocials(form);
      const res = await membersApi.updateMe(normalized);
      emitProfileUpdated(res.data.foto?.url ?? normalized.foto?.url ?? '');
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCommitPhoto = async (next: ImageUploadValue) => {
    if (!user?.npm) return;
    const foto: ImageUploadValue = {
      url: normalizeSocialLink('photo', next.url),
      config: next.config,
    };
    const res = await membersApi.updateMe({ foto });
    const savedFoto = res.data.foto ?? foto;
    setForm((prev) => ({ ...prev, foto: savedFoto }));
    emitProfileUpdated(savedFoto.url);
    toast.success('Profile photo saved');
  };

  return (
    <PageContainer>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="My Profile"
          description="Manage your profile and personal data."
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,672px)_300px]">
        <form onSubmit={handleSubmit} className="grid max-w-2xl gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="npm">NPM</Label>
            <Input id="npm" value={user?.npm ?? ''} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nama_panggilan">Nickname</Label>
            <Input
              id="nama_panggilan"
              value={form.nama_panggilan}
              onChange={(e) => handleChange('nama_panggilan', e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="programId">Study program</Label>
            <Select
              value={form.programId}
              onValueChange={(value) => handleChange('programId', value ?? '')}
              required
            >
              <SelectTrigger id="programId" className="w-full">
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
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Social links</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <SocialLinkField
              id="instagram"
              label="Instagram"
              platform="instagram"
              value={form.instagram}
              onChange={(value) => handleChange('instagram', value)}
            />
            <SocialLinkField
              id="line"
              label="LINE"
              platform="line"
              value={form.line}
              onChange={(value) => handleChange('line', value)}
            />
            <SocialLinkField
              id="github"
              label="GitHub"
              platform="github"
              value={form.github}
              onChange={(value) => handleChange('github', value)}
            />
            <SocialLinkField
              id="linkedin"
              label="LinkedIn"
              platform="linkedin"
              value={form.linkedin}
              onChange={(value) => handleChange('linkedin', value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="deskripsi">Description</Label>
            <Textarea
              id="deskripsi"
              value={form.deskripsi}
              onChange={(e) => handleChange('deskripsi', e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="niche">Niche</Label>
            <Textarea
              id="niche"
              value={form.niche}
              onChange={(e) => handleChange('niche', e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quotes">Quotes</Label>
          <Textarea
            id="quotes"
            value={form.quotes}
            onChange={(e) => handleChange('quotes', e.target.value)}
            rows={2}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            <Save aria-hidden="true" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
            <h3 className="text-sm font-semibold">Profile photo</h3>
            <div className="mt-3">
              <ImageUploadEditor
                endpoint="/upload/avatar"
                value={form.foto}
                onChange={(foto) => setForm((prev) => ({ ...prev, foto }))}
                onCommit={handleCommitPhoto}
              />
            </div>
          </div>
        </aside>
      </div>
      </div>
    </PageContainer>
  );
}


