import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import {
  ImageConfigSchema,
  AchievementCreateSchema,
  AchievementUpdateSchema,
  LatestAchievementSchema,
  YearGroupSchema,
} from '@zenith/shared';
import { achievements } from '../db/schema.js';

describe('Achievement & ImageConfig schemas', () => {
  it('accepts rotate in ImageConfigSchema', () => {
    const parsed = ImageConfigSchema.parse({ x: 50, y: 50, zoom: 1.5, rotate: 90, aspect: '1:1' });
    expect(parsed.rotate).toBe(90);
  });

  it('allows minimal yearly archive achievement when isFeatured is false', () => {
    const parsed = AchievementCreateSchema.parse({
      id: '2030-1',
      title: 'Lomba Lorem Ipsum',
      year: 2030,
      isFeatured: false,
    });
    expect(parsed.isFeatured).toBe(false);
    expect(parsed.members).toEqual([]);
  });

  it('rejects featured achievement missing showcase fields', () => {
    const result = AchievementCreateSchema.safeParse({
      id: 'ioai-2024',
      title: 'Lomba Lorem Ipsum',
      year: 2024,
      isFeatured: true,
    });
    expect(result.success).toBe(false);
  });

  it('accepts complete featured achievement and matches LatestAchievement & YearGroup shapes', () => {
    const feat = AchievementCreateSchema.parse({
      id: 'ioai-2024',
      title: 'Lomba Lorem Ipsum',
      award: 'JUARA 1',
      year: 2024,
      isFeatured: true,
      image: { url: 'https://cdn.csui.dev/achievements/ioai-2024.webp', config: { x: 50, y: 50, zoom: 1, rotate: 0, aspect: '16:9' } },
      teamName: 'Team Lorem Ipsum',
      members: ["Lorem IK'26", "Ipsum IK KKI'26"],
      description: 'Won first place.',
      showOverlay: false,
    });
    expect(feat.showOverlay).toBe(false);
    expect(LatestAchievementSchema.parse({ ...feat, image: feat.image.url }).id).toBe('ioai-2024');
    expect(YearGroupSchema.parse({ year: 2030, items: [{ id: '2030-1', title: 'Lomba', year: 2030 }] }).year).toBe(2030);
  });

  it('does not inject defaults when parsing partial updates', () => {
    const patch = AchievementUpdateSchema.parse({ title: 'Updated Title' });
    expect(patch).toEqual({ title: 'Updated Title' });
  });

  it('defines achievements Drizzle table columns', () => {
    const cols = getTableColumns(achievements);
    expect(Object.keys(cols)).toEqual(
      expect.arrayContaining([
        'id',
        'title',
        'award',
        'year',
        'isFeatured',
        'image',
        'teamName',
        'members',
        'description',
        'showOverlay',
        'position',
        'createdAt',
        'updatedAt',
      ]),
    );
    expect(cols.isFeatured.name).toBe('is_featured');
    expect(cols.teamName.name).toBe('team_name');
    expect(cols.showOverlay.name).toBe('show_overlay');
  });
});
