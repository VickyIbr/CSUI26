import type { Member as SharedMember } from '@zenith/shared';

export type Member = Omit<SharedMember, 'major' | 'programId'> & {
  major: string;
  programId: string;
};
