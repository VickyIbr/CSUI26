import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Paginator } from '@/components/Paginator';

describe('Paginator', () => {
  it('is not rendered for a single page', () => {
    const { container } = render(
      <Paginator page={1} totalPages={1} total={4} onPageChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows page position', () => {
    render(<Paginator page={2} totalPages={5} total={100} onPageChange={() => {}} />);
    expect(screen.getByText('Page 2 of 5 - 100 items')).toBeInTheDocument();
  });

  it('disables previous page on first page', () => {
    render(<Paginator page={1} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });

  it('calls onPageChange when page clicked', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Paginator page={2} totalPages={5} onPageChange={onPageChange} />);
    await user.click(screen.getByRole('button', { name: 'Page 4' }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });
});





