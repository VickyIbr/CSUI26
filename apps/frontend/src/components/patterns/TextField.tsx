import type { ComponentProps } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface BaseFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}

type TextFieldProps = BaseFieldProps & ComponentProps<typeof Input>;
type TextAreaFieldProps = BaseFieldProps & ComponentProps<typeof Textarea>;

function describedBy(id: string, error?: string, hint?: string) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function TextField({ id, label, error, hint, ...props }: TextFieldProps) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, hint)}
        {...props}
      />
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
      {!error && hint ? <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription> : null}
    </Field>
  );
}

export function TextAreaField({ id, label, error, hint, ...props }: TextAreaFieldProps) {
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, hint)}
        {...props}
      />
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
      {!error && hint ? <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription> : null}
    </Field>
  );
}
