export interface AuthUser {
  nama: string;
  npm?: string;
  nip?: string;
  role?: string;
  kd_org?: string;
  email?: string;
  isAdmin: boolean;
  isWhitelisted: boolean;
  isSuperAdmin: boolean;
  org?: { faculty: string; studyProgram: string; programType: string };
}
