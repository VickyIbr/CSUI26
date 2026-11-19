import { ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { SocialPlatform } from '@/features/members/socialLinks';
import { getSocialLinkHref, openSocialLink } from '@/features/members/socialLinks';

interface SocialLinkFieldProps {
  id: string;
  label: string;
  platform: SocialPlatform;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
}

export function SocialLinkField({
  id,
  label,
  platform,
  value,
  onChange,
  error,
  hint,
  placeholder,
}: SocialLinkFieldProps) {
  const href = getSocialLinkHref(platform, value);

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          onChange={(event) => onChange(event.target.value)}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Open ${label} link`}
          disabled={!href}
          onClick={() => openSocialLink(platform, value)}
        >
          <ExternalLink aria-hidden="true" />
        </Button>
      </div>
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
      {!error && hint ? <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription> : null}
    </Field>
  );
}