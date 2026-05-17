import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  type Assignment,
  type CourseDetail,
  type EnrolledStudent,
  type UserRow,
} from "../api";
import { useAuth } from "../auth/AuthContext";
import { usePositiveIntParam } from "../App";
import { CollapsibleCard } from "../components/CollapsibleCard";
import { CourseMaterialsSection } from "../components/CourseMaterialsSection";
import { CourseSection } from "../components/CourseSection";
import { EnrolledStudentsSection } from "../components/EnrolledStudentsSection";
import { SearchableSelect, userSelectOptions } from "../components/SearchableSelect";
import { enrollmentSummary, seatsRemaining } from "../lib/course";
import { backLabel, courseLabel, ELLIPSIS } from "../lib/text";

export function CoursePage() {
  const courseId = usePositiveIntParam("courseId");
  if (!courseId) {
    return <Navigate to="/" replace />;
  }
  return <CoursePageContent courseId={courseId} />;
}

function CoursePageContent({ courseId }: { courseId: number }) {
  const { user } = useAuth();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<EnrolledStudent[] | null>(null);
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [addStudentId, setAddStudentId] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [maxEnrollment, setMaxEnrollment] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const isStudent = user?.role === "student";
  const isAdmin = user?.role === "admin";
  const isCourseProfessor =
    user?.role === "lecturer" && course != null && course.instructor_id === user.id;
  const canViewRoster = isCourseProfessor || isAdmin;
  const canViewMaterials =
    isAdmin || isCourseProfessor || (isStudent && course != null && course.is_enrolled);
  const canManageMaterials = isCourseProfessor || isAdmin;

  async function reload() {
    const c = await apiGet<CourseDetail>(`/courses/${courseId}`);
    setCourse(c);
    setInstructorId(String(c.instructor_id));
    setMaxEnrollment(String(c.max_enrollment));
    const professorOrEnrolled = c.is_enrolled;
    if (professorOrEnrolled) {
      const a = await apiGet<Assignment[]>(`/courses/${courseId}/assignments`);
      setAssignments(a);
    } else {
      setAssignments([]);
    }
    const staff =
      (user?.role === "lecturer" && c.instructor_id === user.id) || user?.role === "admin";
    if (staff) {
      const roster = await apiGet<EnrolledStudent[]>(`/courses/${courseId}/enrollments`);
      setStudents(roster);
    } else {
      setStudents(null);
    }
    if (user?.role === "admin") {
      const users = await apiGet<UserRow[]>("/users");
      setAllUsers(users);
    }
  }

  const lecturers = allUsers.filter((u) => u.role === "lecturer" && u.is_active);
  const lecturerOptions = userSelectOptions(lecturers);
  const enrolledIds = new Set(students?.map((s) => s.user_id) ?? []);
  const studentsAvailable = allUsers.filter(
    (u) => u.role === "student" && u.is_active && !enrolledIds.has(u.id),
  );

  async function saveCourseAdmin() {
    if (course == null) {
      return;
    }
    const iid = Number.parseInt(instructorId, 10);
    const cap = Number.parseInt(maxEnrollment, 10);
    if (!Number.isFinite(iid)) {
      setErr("Select a professor");
      return;
    }
    if (!Number.isFinite(cap) || cap < 1) {
      setErr("Enter a valid maximum enrollment (at least 1)");
      return;
    }
    const body: { instructor_id?: number; max_enrollment?: number } = {};
    if (iid !== course.instructor_id) {
      body.instructor_id = iid;
    }
    if (cap !== course.max_enrollment) {
      body.max_enrollment = cap;
    }
    if (Object.keys(body).length === 0) {
      return;
    }
    setAdminBusy(true);
    setErr(null);
    setOk(null);
    try {
      await apiPatch<CourseDetail>(`/courses/${courseId}`, body);
      setOk("Course settings updated.");
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
    } finally {
      setAdminBusy(false);
    }
  }

  async function enrollStudent() {
    const sid = Number.parseInt(addStudentId, 10);
    if (!Number.isFinite(sid)) {
      setErr("Select a student");
      return;
    }
    setEnrollBusy(true);
    setErr(null);
    setOk(null);
    try {
      await apiPost(`/courses/${courseId}/enrollments`, { user_id: sid });
      setAddStudentId("");
      setOk("Student enrolled.");
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Enroll failed");
    } finally {
      setEnrollBusy(false);
    }
  }

  async function unenrollStudent(studentUserId: number, name: string) {
    if (!window.confirm(`Remove ${name} from this course?`)) {
      return;
    }
    setErr(null);
    setOk(null);
    try {
      await apiDelete(`/courses/${courseId}/enrollments/${studentUserId}`);
      setOk("Student unenrolled.");
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unenroll failed");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Load failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  async function enroll() {
    setErr(null);
    try {
      const res = await apiPost<{ enrollment_id: number; status: string }>(
        `/courses/${courseId}/enrollments`,
        {},
      );
      if (res.status === "already_enrolled") {
        setErr("You are already enrolled in this course.");
      }
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Enroll failed";
      if (msg.includes("already_enrolled")) {
        setErr("You are already enrolled in this course.");
        return;
      }
      if (msg.toLowerCase().includes("full")) {
        setErr(msg);
        return;
      }
      setErr(msg);
    }
  }

  const assignmentCount = assignments.length;
  const studentEnrolled = isStudent && course != null && course.is_enrolled;
  const studentContentFlat = studentEnrolled;

  return (
    <div className={`page-stack${isStudent ? " page-stack--course" : ""}`}>
      {err ? <p className="err">{err}</p> : null}
      {ok ? <p className="ok-msg">{ok}</p> : null}
      {!course ? <p className="muted">Loading{ELLIPSIS}</p> : null}
      {course ? (
        <>
          <div className="card course-hero">
            <div className="course-hero__head">
              <h2 className="course-hero__title">{courseLabel(course.code, course.title)}</h2>
              {isStudent ? (
                <span className={`pill ${course.is_enrolled ? "pill-ok" : "pill-warn"}`}>
                  {course.is_enrolled ? "Enrolled" : "Not enrolled"}
                </span>
              ) : null}
            </div>
            {course.description ? <p className="course-hero__desc">{course.description}</p> : null}
            <p className="course-hero__meta muted">
              Professor: <strong>{course.instructor_name}</strong>
              {" \u00b7 "}
              {enrollmentSummary(course.enrollment_count, course.max_enrollment)}
            </p>
            <div className="course-hero__actions">
              {isStudent && !course.is_enrolled ? (
                <>
                  {course.is_full ? (
                    <p className="course-hero__hint muted">This course is full. No seats available.</p>
                  ) : (
                    <p className="course-hero__hint muted">
                      {seatsRemaining(course.enrollment_count, course.max_enrollment)} seat
                      {seatsRemaining(course.enrollment_count, course.max_enrollment) === 1 ? "" : "s"} left.
                      Enroll to access lecture chat, grades, assignments, and materials.
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={enroll}
                    disabled={course.is_full}
                  >
                    {course.is_full ? "Course full" : "Enroll in this course"}
                  </button>
                </>
              ) : (
                <>
                  <Link className="btn btn-primary" to={`/courses/${courseId}/lecture`}>
                    Live lecture chat
                  </Link>
                  <Link className="btn" to={`/courses/${courseId}/grades`}>
                    Grades
                  </Link>
                </>
              )}
            </div>
          </div>
          {isAdmin ? (
            <CollapsibleCard title="Course administration" defaultOpen={false}>
              <div className="admin-course-form">
                <SearchableSelect
                  id="prof-swap"
                  label="Assigned professor"
                  options={lecturerOptions}
                  value={instructorId}
                  onChange={setInstructorId}
                  placeholder="Search professor by name or email..."
                  emptyLabel="No professors match"
                  disabled={lecturers.length === 0}
                  required
                />
                <div className="field">
                  <label htmlFor="course-cap">Maximum enrollment</label>
                  <input
                    id="course-cap"
                    type="number"
                    min={course.enrollment_count}
                    max={500}
                    value={maxEnrollment}
                    onChange={(e) => setMaxEnrollment(e.target.value)}
                    required
                  />
                  <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
                    Currently {course.enrollment_count} enrolled. Cannot set below that number.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={adminBusy || lecturers.length === 0}
                  onClick={() => void saveCourseAdmin()}
                >
                  {adminBusy ? `Saving${ELLIPSIS}` : "Save settings"}
                </button>
              </div>
            </CollapsibleCard>
          ) : null}
          {canViewRoster ? (
            <EnrolledStudentsSection
              students={students}
              isAdmin={isAdmin}
              addStudentId={addStudentId}
              onAddStudentIdChange={setAddStudentId}
              studentsAvailable={studentsAvailable}
              enrollBusy={enrollBusy}
              courseFull={course.is_full}
              onEnroll={() => void enrollStudent()}
              onUnenroll={(userId, name) => void unenrollStudent(userId, name)}
            />
          ) : null}
          <CourseMaterialsSection
            courseId={courseId}
            canView={canViewMaterials}
            canManage={canManageMaterials}
            collapsible={!studentContentFlat}
            defaultOpen={!studentContentFlat && isCourseProfessor}
          />
          <CourseSection
            title="Assignments"
            badge={assignmentCount}
            collapsible={!studentContentFlat}
            defaultOpen={!studentContentFlat && isCourseProfessor}
            actions={
              isCourseProfessor ? (
                <Link to={`/courses/${courseId}/assignments/new`} className="btn btn-primary">
                  + Add assignment
                </Link>
              ) : undefined
            }
          >
            {isStudent && !course.is_enrolled ? (
              <p className="muted empty-hint">Enroll to view and submit assignments.</p>
            ) : null}
            {(!isStudent || course.is_enrolled) && assignments.length === 0 ? (
              <p className="muted empty-hint">No assignments for this course.</p>
            ) : null}
            {(!isStudent || course.is_enrolled) && assignments.length > 0 ? (
              <ul className="list list--tiles">
                {assignments.map((a) => (
                  <li key={a.id}>
                    <Link to={`/assignments/${a.id}`} className="list-tile">
                      <span className="list-tile__title">{a.title}</span>
                      {a.due_at ? (
                        <span className="list-tile__meta">Due {new Date(a.due_at).toLocaleString()}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </CourseSection>
        </>
      ) : null}
      <Link
        to={isStudent && course && !course.is_enrolled ? "/catalog" : "/"}
        className="back-link"
      >
        {isStudent && course && !course.is_enrolled
          ? backLabel("Course catalog")
          : isAdmin
            ? backLabel("All courses")
            : backLabel("My courses")}
      </Link>
    </div>
  );
}
