import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TextField } from '@/components/patterns/TextField';

describe('TextField', () => {
  it('merender label yang terhubung ke input', () => {
    render(<TextField id="npm" label="NPM" />);
    const input = screen.getByLabelText('NPM');
    expect(input).toHaveAttribute('id', 'npm');
  });

  it('menampilkan error dan menyambungkannya ke input', () => {
    render(<TextField id="npm" label="NPM" error="NPM harus 10 digit angka" />);
    const input = screen.getByLabelText('NPM');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'npm-error');
    expect(screen.getByText('NPM harus 10 digit angka')).toHaveAttribute('id', 'npm-error');
  });

  it('memakai hint saat tidak ada error', () => {
    render(<TextField id="npm" label="NPM" hint="10 digit angka." />);
    const input = screen.getByLabelText('NPM');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(input).toHaveAttribute('aria-describedby', 'npm-hint');
  });
});
