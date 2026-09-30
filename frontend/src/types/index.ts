export type Role =
  | 'super_admin'
  | 'school_admin'
  | 'principal'
  | 'academic'
  | 'registrar'
  | 'registration'
  | 'teacher'
  | 'accountant'
  | 'parent'
  | 'student'
  | 'librarian'
  | 'nurse';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  permissions?: string[];
  avatar_url?: string | null;
  phone?: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface Student {
  id: number;
  admission_no: string;
  first_name: string;
  last_name: string;
  gender: 'male' | 'female' | 'other';
  dob?: string | null;
  date_of_birth: string;
  status: 'active' | 'inactive' | 'graduated' | 'transferred' | 'withdrawn' | 'suspended' | string;
  level_id?: number | null;
  grade_id?: number | null;
  section_id?: number | null;
  academic_year_id?: number | null;
  grade?: { id: number; name: string } | string | null;
  section?: { id: number; name: string } | string | null;
  grade_level?: string;
  parent_id?: number | null;
  phone?: string | null;
  address?: string | null;
}

export interface Teacher {
  id: number;
  staff_no: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  subject: string;
  qualification?: string | null;
  status: 'active' | 'on_leave' | 'inactive';
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
  id: number;
  student_id: number;
  student_name: string;
  class_name: string;
  date: string;
  status: AttendanceStatus;
  remarked_by?: string | null;
}

export interface Exam {
  id: number;
  title: string;
  name?: string | null;
  subject?: string | null;
  subject_id?: number | null;
  class_name?: string | null;
  grade_id?: number | null;
  section_id?: number | null;
  exam_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  exam_type?: string | null;
  term_id?: number | null;
  academic_year_id?: number | null;
  total_marks?: number | null;
  status?: 'draft' | 'scheduled' | 'ongoing' | 'completed' | 'published';
  is_published?: boolean | null;
}

export interface ExamResult {
  id?: number;
  exam_id?: number;
  student_id: number;
  student_name?: string | null;
  score?: number | null;
  marks_obtained?: number | null;
  grade?: string | null;
}

export type InvoiceStatus =
  | 'unpaid'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'proof_submitted'
  | 'under_verification';

export interface Invoice {
  id: number;
  invoice_no: string;
  student_id: number;
  student_name?: string;
  student?: { id: number; first_name: string; last_name: string; full_name?: string; admission_no?: string } | null;
  amount: number;
  total?: number;
  amount_paid: number;
  balance: number;
  due_date: string;
  status: InvoiceStatus | string;
  items?: Array<{
    id: number;
    description: string;
    quantity?: number;
    unit_price: number;
    total: number;
  }>;
  payments?: Array<{
    id: number;
    amount: number | string;
    status: string;
    payment_date: string;
  }>;
}

export interface PaymentProof {
  id: number;
  invoice_id: number;
  amount: number;
  method: string;
  receipt_url?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
}

export type NotificationTone = 'red' | 'orange' | 'blue' | 'green' | 'slate';

export interface NotificationItem {
  id: number;
  type: string;
  title: string | null;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Message {
  id: number;
  sender_id: number;
  sender_name?: string | null;
  sender_role?: Role | string | null;
  recipient_role?: Role | 'all' | 'direct' | null;
  conversation_id?: number;
  subject: string;
  body: string | null;
  is_starred: boolean;
  is_read: boolean;
  context?: 'fees' | 'grades' | 'attendance' | 'general' | null;
  created_at: string;
}

export type ApplicationStatus =
  | 'pending'
  | 'under_review'
  | 'accepted'
  | 'rejected'
  | 'waitlisted'
  | 'suspended'
  | 'enrolled';

export interface Application {
  id: number;
  application_no: string;
  first_name: string;
  last_name: string;
  gender?: string | null;
  dob?: string | null;
  applying_grade_id?: number | null;
  applying_level_id?: number | null;
  academic_year_id?: number | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  parent_email?: string | null;
  address?: string | null;
  status: ApplicationStatus;
  submitted_at?: string | null;
  decided_at?: string | null;
  notes?: string | null;
  contact_method?: string | null;
  contacted_at?: string | null;
  contact_note?: string | null;
  notified_at?: string | null;
  enrolled_at?: string | null;
  student_id?: number | null;
  parent_id?: number | null;
  created_at?: string;
  documents?: Array<{ id: number; document_type?: string; file_path?: string }>;
}

export interface DashboardStat {
  label: string;
  value: string;
  delta?: string;
}

export type TaskTone = 'red' | 'orange' | 'blue' | 'green';

export interface StatsTask {
  label: string;
  count: number;
  tone: TaskTone;
}

export interface Stats {
  my_tasks?: StatsTask[];
  [key: string]: unknown;
}

export interface TimelineEvent {
  date: string;
  type: string;
  title: string;
  detail?: string | null;
}

export interface StudentTimeline {
  student: Student;
  events: TimelineEvent[];
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  level_id?: number | null;
  level_name?: string | null;
}

export interface AssignmentSubmission {
  id: number;
  assignment_id?: number;
  student_id: number;
  student_name?: string | null;
  answer?: string | null;
  score?: number | null;
  submitted_at?: string | null;
}

export interface Assignment {
  id: number;
  title: string;
  description?: string | null;
  due_date?: string | null;
  grade_id?: number | null;
  section_id?: number | null;
  subject_id?: number | null;
  grade_name?: string | null;
  section_name?: string | null;
  subject_name?: string | null;
  submitted_count?: number;
  total_students?: number;
  submissions?: AssignmentSubmission[];
}

export interface ReportCardLine {
  subject: string;
  score: number;
  grade?: string | null;
}

export interface ReportCard {
  id: number;
  student_id: number;
  student_name?: string | null;
  admission_no?: string | null;
  grade_level?: string | null;
  term_id?: number | null;
  term_name?: string | null;
  attendance_percent?: number | null;
  average?: number | null;
  comments?: string | null;
  subjects?: ReportCardLine[];
  lines?: ReportCardLine[];
  overall_grade?: string | null;
  rank_in_class?: number | null;
  total_students?: number | null;
  status?: string | null;
}

export type SkillRating = 'Excellent' | 'Good' | 'Developing' | 'Needs Support';

export interface PreschoolAssessment {
  id: number;
  student_id: number;
  student_name?: string | null;
  skill: string;
  rating: SkillRating;
  term_id?: number | null;
  created_at?: string | null;
}

export interface TimetableSlot {
  id: number;
  day: string;
  period: number | string;
  subject_id?: number | null;
  subject?: string | null;
  teacher_id?: number | null;
  teacher?: string | null;
  room?: string | null;
  grade_id?: number | null;
  section_id?: number | null;
}

export interface Book {
  id: number;
  title: string;
  author?: string | null;
  isbn?: string | null;
  category?: string | null;
  total_copies?: number | null;
  available_copies?: number | null;
}

export interface Borrowing {
  id: number;
  book_id: number;
  student_id: number;
  book_title?: string | null;
  student_name?: string | null;
  borrowed_at?: string | null;
  due_date?: string | null;
  returned_at?: string | null;
  fine?: number | null;
  status?: 'borrowed' | 'returned' | 'overdue';
}

export interface HealthVisit {
  id: number;
  student_id: number;
  student_name?: string | null;
  visit_date: string;
  reason?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  temperature?: number | null;
}

export interface HealthRecord {
  id: number;
  student_id: number;
  student_name?: string | null;
  record_date: string;
  type?: string | null;
  detail?: string | null;
  recorded_by?: string | null;
}

export interface TransportRoute {
  id: number;
  name: string;
  code?: string | null;
  driver?: string | null;
  phone?: string | null;
  plate_no?: string | null;
  stops?: string | null;
  stops_count?: number | null;
  fare?: number | null;
  capacity?: number | null;
  is_active?: boolean | null;
}

export interface SummaryCardData {
  label: string;
  value: string | number;
  delta?: string | null;
}

export interface ReportSummary {
  report: string;
  title?: string | null;
  cards?: SummaryCardData[];
  items?: SummaryCardData[];
  metrics?: SummaryCardData[];
  [key: string]: unknown;
}
