import { getStoredToken } from "./auth/AuthContext";

const prefix = "/api";

function authHeaders(): HeadersInit {
  const t = getStoredToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) {
    h.Authorization = `Bearer ${t}`;
  }
  return h;
}

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(`${prefix}${path}`, { headers: authHeaders() });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  return r.json() as Promise<T>;
}

async function readErrorMessage(r: Response): Promise<string> {
  const t = await r.text();
  try {
    const j = JSON.parse(t) as { detail?: string | { msg?: string }[] };
    if (typeof j.detail === "string") {
      return j.detail;
    }
    if (Array.isArray(j.detail) && j.detail[0]?.msg) {
      return j.detail[0].msg;
    }
  } catch {
    /* plain text */
  }
  return t || r.statusText;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${prefix}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    throw new Error(await readErrorMessage(r));
  }
  if (r.status === 204) {
    return undefined as T;
  }
  return r.json() as Promise<T>;
}

export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const t = getStoredToken();
  const h: Record<string, string> = {};
  if (t) {
    h.Authorization = `Bearer ${t}`;
  }
  const r = await fetch(`${prefix}${path}`, {
    method: "POST",
    headers: h,
    body: form,
  });
  if (!r.ok) {
    throw new Error(await readErrorMessage(r));
  }
  return r.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${prefix}${path}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    throw new Error(await readErrorMessage(r));
  }
  return r.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const r = await fetch(`${prefix}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!r.ok) {
    throw new Error(await readErrorMessage(r));
  }
}

export type UserRow = {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
};

export type Course = {
  id: number;
  code: string;
  title: string;
  description: string | null;
  instructor_id: number;
  instructor_name: string;
};

export type EnrolledStudent = {
  user_id: number;
  email: string;
  full_name: string;
  enrolled_at: string;
};

/** From GET /courses/{id} — includes self-enrollment state for students. */
export type CourseDetail = Course & { is_enrolled: boolean };

export type Assignment = {
  id: number;
  course_id: number;
  title: string;
  description: string | null;
  due_at: string | null;
};

/** GET /assignments/{id} — includes instructor_id for grading permissions. */
export type AssignmentContext = {
  id: number;
  course_id: number;
  title: string;
  instructor_id: number;
};

export type Submission = {
  id: number;
  /** Snowflake ID — always use as string in URLs (JSON may serialize as string). */
  public_id: string;
  assignment_id: number;
  student_id: number;
  student_name: string | null;
  student_email: string | null;
  submitted_at: string;
  replaced?: boolean;
  body_text: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  plagiarism_status: string;
  plagiarism_score: number | null;
  grade_score: number | null;
  grade_feedback: string | null;
};

export type LectureMessage = {
  id: number;
  user: string;
  text: string;
  sent_at: string;
  is_pinned?: boolean;
};

export type GradeRow = {
  id: number;
  submission_id: number;
  score: number;
  letter_grade: string | null;
  feedback: string | null;
  graded_by: number;
  student_id: number;
  student_name: string;
  assignment_id: number;
  assignment_title: string;
  plagiarism_score: number | null;
  plagiarism_status: string;
};

export function wsLectureUrl(courseId: number, token: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const q = new URLSearchParams({ token });
  return `${proto}//${window.location.host}/ws/lectures/${courseId}?${q}`;
}

export function gradesExportUrl(courseId: number): string {
  return `${prefix}/courses/${courseId}/grades/export`;
}
