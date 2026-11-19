import orgData from './data/org_code_details.json' with { type: 'json' };

export interface RawOrgEntry {
  faculty: string;
  shortFaculty?: string;
  major?: string;
  program?: string;
  studyProgram?: string;
  programType?: string;
  study_program?: string;
  educational_program?: string;
}

export interface OrgDetail {
  /** Indonesian faculty name (e.g. "Fakultas Ilmu Komputer") */
  fakultas: string;
  /** Faculty name (Indonesian full name, e.g. "Fakultas Ilmu Komputer") */
  faculty: string;
  /** English faculty name (e.g. "Faculty of Computer Science") */
  facultyEn: string;
  /** Short Indonesian faculty name (e.g. "Fasilkom") */
  fak: string;
  /** Short English faculty code (e.g. "CS") */
  fac: string;
  /** Indonesian department name */
  departemen: string;
  /** English department name */
  department: string;
  /** Short department code */
  dep: string;
  /** Indonesian study program name (e.g. "Ilmu Komputer") */
  prodi: string;
  /** English major name (e.g. "Computer Science") */
  major: string;
  /** Zenith studyProgram (clean Indonesian study program name, e.g. "Ilmu Komputer") */
  studyProgram: string;
  /** Zenith normalized degree level (e.g. "S1", "S2", "S3", "D3", "Profesi", "Spesialis") */
  programType: string;
  /** Full program label from UI catalog (e.g. "S1 Reguler (Undergraduate Program)") */
  educationalProgram: string;
  /** rkkautsar/sso-ui snake_case aliases */
  study_program: string;
  educational_program: string;
}

export type OrgDetails = OrgDetail;

export const ORG_CODES: Readonly<Record<string, RawOrgEntry>> = orgData as Record<string, RawOrgEntry>;

const FACULTY_EN_MAP: Record<string, { en: string; fac: string }> = {
  'Kedokteran': { en: 'Faculty of Medicine', fac: 'FK' },
  'Kedokteran Gigi': { en: 'Faculty of Dentistry', fac: 'FKG' },
  'Matematika & Ilmu Pengetahuan Alam': { en: 'Faculty of Mathematics and Natural Sciences', fac: 'SCI' },
  'Teknik': { en: 'Faculty of Engineering', fac: 'ENG' },
  'Hukum': { en: 'Faculty of Law', fac: 'LAW' },
  'Ekonomi': { en: 'Faculty of Economics and Business', fac: 'FEB' },
  'Ekonomi & Bisnis': { en: 'Faculty of Economics and Business', fac: 'FEB' },
  'Ilmu Pengetahuan Budaya': { en: 'Faculty of Humanities', fac: 'HUM' },
  'Psikologi': { en: 'Faculty of Psychology', fac: 'FPSI' },
  'Ilmu Sosial & Ilmu Politik': { en: 'Faculty of Social and Political Sciences', fac: 'FISIP' },
  'Kesehatan Masyarakat': { en: 'Faculty of Public Health', fac: 'FKM' },
  'Ilmu Komputer': { en: 'Faculty of Computer Science', fac: 'CS' },
  'Ilmu Keperawatan': { en: 'Faculty of Nursing', fac: 'FIK' },
  'Farmasi': { en: 'Faculty of Pharmacy', fac: 'PHARM' },
  'Ilmu Administrasi': { en: 'Faculty of Administrative Sciences', fac: 'FIA' },
  'Program Pendidikan Vokasi': { en: 'Vocational Education Program', fac: 'VOKASI' },
  'Sekolah Ilmu Lingkungan': { en: 'School of Environmental Science', fac: 'SIL' },
  'Sekolah Kajian Stratejik & Global': { en: 'School of Strategic and Global Studies', fac: 'SKSG' },
};

function normalizeFacultyId(rawFaculty: string): { base: string; full: string } {
  const trimmed = rawFaculty.trim().replace(/^Fakultas\s+/i, '');
  const full =
    rawFaculty.startsWith('Fakultas') ||
    rawFaculty.startsWith('Sekolah') ||
    rawFaculty.startsWith('Program')
      ? rawFaculty.trim()
      : `Fakultas ${trimmed}`;
  return { base: trimmed, full };
}

function extractProgramType(rawProgram: string): string {
  const match = rawProgram.trim().match(/^(S1|S2|S3|D3|D4|Profesi|Spesialis)/i);
  return match ? match[1] : rawProgram.trim();
}

function buildOrgDetail(raw: RawOrgEntry): OrgDetail {
  const { base, full } = normalizeFacultyId(raw.faculty);
  const fak = raw.shortFaculty || '';
  const meta = FACULTY_EN_MAP[base] || { en: `Faculty of ${base}`, fac: fak };

  const rawMajor = raw.major || raw.studyProgram || raw.study_program || '';
  const majorMatch = rawMajor.match(/^(.*?)(?:\s*\((.*?)\))?$/);
  const prodi = (majorMatch?.[1] || rawMajor).trim();
  const majorEn = (majorMatch?.[2] || prodi).trim();

  const educationalProgram =
    raw.program || raw.educational_program || raw.programType || '';
  const programType = raw.programType || extractProgramType(educationalProgram);
  const studyProgram = raw.studyProgram || prodi;

  return {
    fakultas: full,
    faculty: full,
    facultyEn: meta.en,
    fak,
    fac: meta.fac,
    departemen: base,
    department: meta.en,
    dep: fak,
    prodi,
    major: majorEn,
    studyProgram,
    programType,
    educationalProgram,
    study_program: rawMajor || studyProgram,
    educational_program: educationalProgram,
  };
}

const resolvedOrgMap: Record<string, OrgDetail> = Object.fromEntries(
  Object.entries(ORG_CODES).map(([code, raw]) => [code, buildOrgDetail(raw)]),
);

/** Resolve a UI organization code to faculty and study program metadata (returns null if unknown). */
export function mapOrgCode(kd_org?: string): OrgDetail | null {
  if (!kd_org) return null;
  return resolvedOrgMap[String(kd_org).trim()] ?? null;
}

/** Resolve a UI organization code (PIPL-CSUI/sso-ui.js compatible alias returning undefined if unknown). */
export function lookupOrgCode(code?: string): OrgDetail | undefined {
  return mapOrgCode(code) ?? undefined;
}

/** Return the read-only resolved organization code dictionary bundled with this package. */
export function getOrgMap(): Readonly<Record<string, OrgDetail>> {
  return resolvedOrgMap;
}
