import apiClient from './client';
import type {
  Assignment,
  AssignmentSubmission,
  Exam,
  ExamResult,
  Paginated,
  PreschoolAssessment,
  ReportCard,
  SkillRating,
  Stats,
  StudentTimeline,
  Subject,
  TimetableSlot,
} from '../types';

interface RawReportCardSubject {
  subject?: string | null;
  code?: string | null;
  obtained?: number | null;
  possible?: number | null;
  percentage?: number | null;
  grade?: string | null;
}

interface RawReportCard {
  id: number;
  student_id: number;
  term_id?: number | null;
  academic_year_id?: number | null;
  overall_average?: number | null;
  overall_grade?: string | null;
  attendance_rate?: number | null;
  rank_in_class?: number | null;
  total_students?: number | null;
  teacher_comment?: string | null;
  status?: string | null;
  payload?: { subjects?: RawReportCardSubject[]; term?: string | null } | null;
  student?: {
    first_name?: string;
    last_name?: string;
    admission_no?: string;
    grade?: { name?: string } | null;
    section?: { name?: string } | null;
  } | null;
  term?: { name?: string } | null;
  student_name?: string | null;
  admission_no?: string | null;
  grade_level?: string | null;
  term_name?: string | null;
  attendance_percent?: number | null;
  average?: number | null;
  comments?: string | null;
}

function toList<T>(data: T[] | Paginated<T>): T[] {
  return Array.isArray(data) ? data : data.data;
}

/**
 * The API nests subject lines under `payload.subjects` and uses different field
 * names than the report-card view expects. Normalise once so every caller works.
 */
export function normalizeReportCard(raw: RawReportCard): ReportCard {
  const payload = raw.payload ?? {};
  const subjects = (payload.subjects ?? []).map((s) => {
    const obtained = s.obtained ?? 0;
    const possible = s.possible ?? 0;
    const score = s.percentage ?? (possible > 0 ? Math.round((obtained / possible) * 100) : 0);
    return { subject: s.subject ?? s.code ?? '—', score, grade: s.grade };
  });

  const student = raw.student;
  const grade = student?.grade;
  const section = student?.section;

  return {
    id: raw.id,
    student_id: raw.student_id,
    student_name: student
      ? `${student.first_name} ${student.last_name}`.trim()
      : raw.student_name ?? null,
    admission_no: student?.admission_no ?? raw.admission_no ?? null,
    grade_level:
      grade?.name != null
        ? section?.name != null
          ? `${grade.name}-${section.name}`
          : grade.name
        : raw.grade_level ?? null,
    term_id: raw.term_id ?? null,
    term_name: raw.term?.name ?? payload.term ?? raw.term_name ?? null,
    attendance_percent: raw.attendance_rate ?? raw.attendance_percent ?? null,
    average: raw.overall_average ?? raw.average ?? null,
    overall_grade: raw.overall_grade ?? null,
    rank_in_class: raw.rank_in_class ?? null,
    total_students: raw.total_students ?? null,
    status: raw.status ?? null,
    comments: raw.teacher_comment ?? raw.comments ?? null,
    subjects,
    lines: subjects,
  };
}

// ---- Stats & timeline -------------------------------------------------------

export async function fetchStats(): Promise<Stats> {
  const { data } = await apiClient.get<Stats>('/stats');
  return data;
}

export async function fetchStudentTimeline(id: number): Promise<StudentTimeline> {
  const { data } = await apiClient.get<StudentTimeline>(`/students/${id}/timeline`);
  return data;
}

// ---- Subjects ---------------------------------------------------------------

interface RawSubject {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  school_level_id?: number | null;
  is_active?: boolean | null;
  school_level?: { id: number; name: string } | null;
}

function normalizeSubject(raw: RawSubject): Subject {
  return {
    id: raw.id,
    name: raw.name,
    code: raw.code,
    level_id: raw.school_level_id ?? null,
    level_name: raw.school_level?.name ?? null,
  };
}

export async function fetchSubjects(): Promise<Subject[]> {
  const { data } = await apiClient.get<RawSubject[] | Paginated<RawSubject>>('/subjects');
  return toList(data).map(normalizeSubject);
}

export async function createSubject(payload: {
  name: string;
  code: string;
  school_level_id?: number | null;
  description?: string | null;
}): Promise<Subject> {
  const { data } = await apiClient.post<RawSubject>('/subjects', payload);
  return normalizeSubject(data);
}

export async function updateSubject(id: number, payload: Partial<Subject>): Promise<Subject> {
  const { data } = await apiClient.patch<RawSubject>(`/subjects/${id}`, payload);
  return normalizeSubject(data);
}

export async function deleteSubject(id: number): Promise<void> {
  await apiClient.delete(`/subjects/${id}`);
}

// ---- Assignments ------------------------------------------------------------

export async function fetchAssignments(): Promise<Assignment[]> {
  const { data } = await apiClient.get<Assignment[] | Paginated<Assignment>>('/assignments');
  return toList(data);
}

export async function createAssignment(payload: Partial<Assignment>): Promise<Assignment> {
  const { data } = await apiClient.post<Assignment>('/assignments', payload);
  return data;
}

export async function submitAssignment(
  assignmentId: number,
  answer: string,
): Promise<AssignmentSubmission> {
  const { data } = await apiClient.post<AssignmentSubmission>(
    `/assignments/${assignmentId}/submissions`,
    { answer },
  );
  return data;
}

export async function gradeSubmission(
  assignmentId: number,
  submissionId: number,
  score: number,
): Promise<AssignmentSubmission> {
  const { data } = await apiClient.post<AssignmentSubmission>(
    `/assignments/${assignmentId}/submissions/${submissionId}/grade`,
    { score },
  );
  return data;
}

// ---- Exams ------------------------------------------------------------------

interface RawExam {
  id: number;
  name?: string | null;
  title?: string | null;
  academic_year_id?: number | null;
  term_id?: number | null;
  exam_type?: string | null;
  type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  exam_date?: string | null;
  status?: string | null;
  description?: string | null;
  total_marks?: number | null;
  subject?: number | string | null;
  subject_id?: number | null;
  grade_id?: number | null;
  exam_subjects_count?: number;
}

function normalizeExam(raw: RawExam): Exam {
  return {
    ...raw,
    title: raw.title ?? raw.name ?? 'Untitled exam',
    exam_date: raw.exam_date ?? raw.start_date ?? raw.end_date ?? null,
    exam_type: raw.exam_type ?? raw.type ?? null,
    total_marks: raw.total_marks ?? null,
  } as Exam;
}

export async function fetchExams(): Promise<Exam[]> {
  const { data } = await apiClient.get<RawExam[] | Paginated<RawExam>>('/exams');
  return toList(data).map(normalizeExam);
}

export async function fetchExam(id: number): Promise<Exam> {
  const { data } = await apiClient.get<RawExam>(`/exams/${id}`);
  return normalizeExam(data);
}

export interface CreateExamPayload {
  name: string;
  academic_year_id: number;
  term_id?: number | null;
  type?: 'quiz' | 'test' | 'midterm' | 'final';
  start_date?: string | null;
  end_date?: string | null;
  total_marks?: number;
  subject_id?: number | null;
  grade_id?: number | null;
  description?: string | null;
}

export async function createExam(payload: CreateExamPayload): Promise<Exam> {
  const { data } = await apiClient.post<RawExam>('/exams', payload);
  return normalizeExam(data);
}

interface RawExamResult {
  id: number;
  exam_subject_id?: number;
  student_id: number;
  marks_obtained?: number | string | null;
  grade_letter?: string | null;
  score?: number | null;
  grade?: string | null;
  student?: { id: number; first_name: string; last_name: string } | null;
  student_name?: string | null;
}

function normalizeExamResult(raw: RawExamResult): ExamResult {
  const marks = raw.marks_obtained ?? raw.score ?? null;
  return {
    id: raw.id,
    exam_id: raw.exam_subject_id,
    student_id: raw.student_id,
    student_name:
      raw.student_name ??
      (raw.student ? `${raw.student.first_name} ${raw.student.last_name}`.trim() : null),
    score: marks == null ? null : Number(marks),
    marks_obtained: marks == null ? null : Number(marks),
    grade: raw.grade ?? raw.grade_letter ?? null,
  };
}

export async function fetchExamResults(examId: number): Promise<ExamResult[]> {
  const { data } = await apiClient.get<RawExamResult[] | Paginated<RawExamResult>>(
    `/exams/${examId}/results`,
  );
  return toList(data).map(normalizeExamResult);
}

export async function saveExamResults(
  examId: number,
  results: Array<{ student_id: number; score: number; exam_subject_id?: number }>,
): Promise<void> {
  await apiClient.post(`/exams/${examId}/results`, { results });
}

export async function publishExam(examId: number): Promise<void> {
  await apiClient.post(`/exams/${examId}/publish`);
}

// ---- Report cards -----------------------------------------------------------

export async function fetchReportCards(
  params: { student_id?: number; term_id?: number } = {},
): Promise<ReportCard[]> {
  const { data } = await apiClient.get<RawReportCard[] | Paginated<RawReportCard>>('/report-cards', {
    params,
  });
  return toList(data).map(normalizeReportCard);
}

export async function generateReportCard(payload: {
  student_id: number;
  term_id: number;
}): Promise<ReportCard> {
  const { data } = await apiClient.post<RawReportCard>('/report-cards', payload);
  return normalizeReportCard(data);
}

export async function fetchReportCard(id: number): Promise<ReportCard> {
  const { data } = await apiClient.get<RawReportCard>(`/report-cards/${id}`);
  return normalizeReportCard(data);
}

/** Downloads the server-rendered PDF for a report card. */
export async function downloadReportCardPdf(id: number, filename?: string): Promise<void> {
  const { data, headers } = await apiClient.get<Blob>(`/report-cards/${id}/pdf`, {
    responseType: 'blob',
  });

  const disposition = String(headers['content-disposition'] ?? '');
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const name = filename ?? match?.[1] ?? `report-card-${id}.pdf`;

  const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// ---- Preschool assessments --------------------------------------------------

export async function fetchPreschoolAssessments(
  params: { student_id?: number } = {},
): Promise<PreschoolAssessment[]> {
  const { data } = await apiClient.get<PreschoolAssessment[] | Paginated<PreschoolAssessment>>(
    '/preschool-assessments',
    { params },
  );
  return toList(data);
}

export async function createPreschoolAssessment(payload: {
  student_id: number;
  skill: string;
  rating: SkillRating;
  term_id?: number;
}): Promise<PreschoolAssessment> {
  const { data } = await apiClient.post<PreschoolAssessment>('/preschool-assessments', payload);
  return data;
}

// ---- Timetable --------------------------------------------------------------

export async function fetchTimetable(
  params: { grade_id?: number; section_id?: number } = {},
): Promise<TimetableSlot[]> {
  const { data } = await apiClient.get<TimetableSlot[] | Record<string, TimetableSlot[]>>(
    '/timetable',
    { params },
  );
  if (Array.isArray(data)) return data;
  // Grouped-by-day payload: { Monday: [...], Tuesday: [...] } — flatten and stamp the day.
  return Object.entries(data).flatMap(([day, slots]) =>
    Array.isArray(slots) ? slots.map((slot) => ({ ...slot, day: slot.day || day })) : [],
  );
}

export async function createTimetableSlot(payload: Partial<TimetableSlot>): Promise<TimetableSlot> {
  const { data } = await apiClient.post<TimetableSlot>('/timetable', payload);
  return data;
}

export async function deleteTimetableSlot(id: number): Promise<void> {
  await apiClient.delete(`/timetable/${id}`);
}
