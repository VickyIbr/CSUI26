import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Achievement, PublicAchievementsResponse } from '@zenith/shared';
import AchievementsPage from './AchievementsPage';
import { achievementsApi } from '@/features/achievements/api';
import * as apiModule from '@/lib/api';

const FIXTURE: PublicAchievementsResponse = {
  latestAchievements: [
    {
      id: 'ioai-2024',
      title: 'IOAI Silver Winner',
      award: 'SILVER',
      image: '/images/achievements/ioai-winner.png',
      imageConfig: { x: 40, y: 60, zoom: 1.2, rotate: 0, aspect: '16:9' },
      teamName: 'Team IOAI',
      members: ["Alice IK'26", "Bob SI'26"],
      description: 'International Olympiad in Artificial Intelligence medalist.',
      showOverlay: false,
    },
    {
      id: 'icpc-2024',
      title: 'ICPC Asia Jakarta',
      award: 'JUARA 1',
      image: '/images/achievements/icpc-winner.png',
      imageConfig: { x: 50, y: 50, zoom: 1, rotate: 0, aspect: '16:9' },
      teamName: 'Team ICPC',
      members: ["Charlie IK'25", "Delta AI'25"],
      description: 'First place at regional programming contest.',
      showOverlay: true,
    },
  ],
  yearlyAchievementsByYear: [
    {
      year: 2030,
      items: [
        { id: 'gemastik-2030', title: 'GEMASTIK Gold', award: 'JUARA 1', year: 2030 },
        { id: 'compfest-2030', title: 'COMPFEST Finalist', year: 2030 },
      ],
    },
    {
      year: 2029,
      items: [
        { id: 'icpc-2029', title: 'ICPC Honorable', award: 'HONORABLE', year: 2029 },
      ],
    },
  ],
};

describe('AchievementsPage', () => {
  beforeAll(() => {
    if (!Element.prototype.hasPointerCapture) {
      Element.prototype.hasPointerCapture = () => false;
    }
    if (!Element.prototype.releasePointerCapture) {
      Element.prototype.releasePointerCapture = () => {};
    }
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = () => {};
    }
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(achievementsApi, 'listGrouped').mockResolvedValue({ data: FIXTURE });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders featured showcase details and respects showOverlay false vs true', async () => {
    render(<AchievementsPage />);

    expect(await screen.findByText('Team IOAI')).toBeInTheDocument();
    expect(screen.getByText('Team ICPC')).toBeInTheDocument();
    expect(screen.getByText("Alice IK'26")).toBeInTheDocument();
    expect(screen.getByText("Charlie IK'25")).toBeInTheDocument();
    expect(screen.getByText('SILVER')).toBeInTheDocument();

    const ioaiImg = screen.getByAltText('IOAI Silver Winner') as HTMLImageElement;
    expect(ioaiImg.style.objectPosition).toBe('40% 60%');
    expect(ioaiImg.style.transform).toBe('scale(1.2) rotate(0deg)');
    expect(ioaiImg.parentElement?.textContent).not.toContain('SILVER');

    const icpcImg = screen.getByAltText('ICPC Asia Jakarta') as HTMLImageElement;
    expect(icpcImg.parentElement?.textContent).toContain('ICPC Asia Jakarta');
    expect(icpcImg.parentElement?.textContent).toContain('JUARA 1');
  });

  it('renders yearly archive groups and filters by year and search keyword', async () => {
    const user = userEvent.setup();
    render(<AchievementsPage />);

    expect(await screen.findByText('GEMASTIK Gold')).toBeInTheDocument();
    expect(screen.getByText('2030')).toBeInTheDocument();
    expect(screen.getByText('2029')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Filter year' }));
    await user.click(await screen.findByRole('option', { name: '2029' }));

    expect(screen.getByText('ICPC Honorable')).toBeInTheDocument();
    expect(screen.queryByText('GEMASTIK Gold')).not.toBeInTheDocument();
    expect(screen.queryByText('Team IOAI')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /reset/i }));
    expect(screen.getByText('GEMASTIK Gold')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search achievements'), {
      target: { value: 'GEMASTIK' },
    });

    expect(screen.getByText('GEMASTIK Gold')).toBeInTheDocument();
    expect(screen.queryByText('COMPFEST Finalist')).not.toBeInTheDocument();
    expect(screen.queryByText('ICPC Honorable')).not.toBeInTheDocument();
  });

  it('validates yearly and featured fields in modal, submits create, and opens edit mode', async () => {
    const user = userEvent.setup();
    const createSpy = vi.spyOn(achievementsApi, 'create').mockResolvedValue({
      data: {
        id: 'compfest-2031',
        title: 'COMPFEST Champion',
        year: 2031,
        isFeatured: false,
        award: '',
        image: { url: '' },
        teamName: '',
        members: [],
        description: '',
        showOverlay: true,
        position: 0,
      },
    });
    const fullRecord: Achievement = {
      id: 'gemastik-2030',
      title: 'GEMASTIK Gold',
      year: 2030,
      isFeatured: false,
      award: 'JUARA 1',
      image: { url: '' },
      teamName: '',
      members: [],
      description: '',
      showOverlay: true,
      position: 0,
    };
    const apiSpy = vi.spyOn(apiModule, 'api').mockResolvedValue({ data: fullRecord });

    render(<AchievementsPage />);
    await screen.findByText('GEMASTIK Gold');

    await user.click(screen.getByRole('button', { name: /add achievement/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('ID is required')).toBeInTheDocument();
    expect(screen.getByText('Title is required')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Featured Showcase item'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Award is required for featured achievements')).toBeInTheDocument();
    expect(screen.getByText('Image URL is required for featured achievements')).toBeInTheDocument();
    expect(screen.getByText('Team name is required for featured achievements')).toBeInTheDocument();
    expect(screen.getByText('At least one team member is required')).toBeInTheDocument();
    expect(screen.getByText('Description is required for featured achievements')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Featured Showcase item'));
    fireEvent.change(screen.getByLabelText('ID'), { target: { value: 'compfest-2031' } });
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2031' } });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'COMPFEST Champion' } });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'compfest-2031',
          year: 2031,
          title: 'COMPFEST Champion',
          isFeatured: false,
        }),
      );
    });

    await user.click(screen.getByRole('button', { name: 'Edit GEMASTIK Gold' }));
    await waitFor(() => {
      expect(apiSpy).toHaveBeenCalledWith('/achievements/gemastik-2030');
    });
    expect(await screen.findByRole('heading', { name: 'Edit achievement' })).toBeInTheDocument();
    expect(screen.getByLabelText('ID')).toBeDisabled();
  });

  it('passes anti-slop copy and button accessibility checks', async () => {
    render(<AchievementsPage />);
    await screen.findByText('GEMASTIK Gold');

    expect(document.body.textContent).not.toContain('—');

    const buttons = screen.getAllByRole('button');
    for (const button of buttons) {
      const accessibleText =
        button.getAttribute('aria-label')?.trim() || button.textContent?.trim() || '';
      expect(accessibleText.length).toBeGreaterThan(0);
    }
  });
});
