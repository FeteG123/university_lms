import type { EnrolledStudent, UserRow } from "../api";
import { CollapsibleCard } from "./CollapsibleCard";
import { SearchableSelect, userSelectOptions } from "./SearchableSelect";
import { ELLIPSIS } from "../lib/text";

type Props = {
  students: EnrolledStudent[] | null;
  isAdmin: boolean;
  addStudentId: string;
  onAddStudentIdChange: (id: string) => void;
  studentsAvailable: UserRow[];
  enrollBusy: boolean;
  courseFull?: boolean;
  onEnroll: () => void;
  onUnenroll: (userId: number, name: string) => void;
};

export function EnrolledStudentsSection({
  students,
  isAdmin,
  addStudentId,
  onAddStudentIdChange,
  studentsAvailable,
  enrollBusy,
  courseFull = false,
  onEnroll,
  onUnenroll,
}: Props) {
  const count = students?.length ?? 0;
  const studentOptions = userSelectOptions(studentsAvailable);

  return (
    <CollapsibleCard title="Enrolled students" badge={count} defaultOpen={false}>
      {isAdmin ? (
        <div className="enroll-toolbar">
          <SearchableSelect
            id="add-student"
            label="Add student"
            className="field--inline"
            options={studentOptions}
            value={addStudentId}
            onChange={onAddStudentIdChange}
            placeholder={
              studentsAvailable.length === 0 ? "No students to add" : "Search by name or email..."
            }
            emptyLabel="No students match"
            disabled={studentsAvailable.length === 0}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={enrollBusy || !addStudentId || courseFull}
            onClick={onEnroll}
          >
            {courseFull ? "Course full" : enrollBusy ? `Enrolling${ELLIPSIS}` : "Enroll student"}
          </button>
        </div>
      ) : null}
      {students === null ? <p className="muted">Loading roster{ELLIPSIS}</p> : null}
      {students && students.length === 0 ? <p className="muted empty-hint">No students enrolled yet.</p> : null}
      {students && students.length > 0 ? (
        <div className="table-wrap">
          <table className="grade-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Enrolled</th>
                {isAdmin ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.user_id}>
                  <td>{s.full_name}</td>
                  <td>{s.email}</td>
                  <td>{new Date(s.enrolled_at).toLocaleString()}</td>
                  {isAdmin ? (
                    <td>
                      <button type="button" className="btn btn-sm" onClick={() => onUnenroll(s.user_id, s.full_name)}>
                        Unenroll
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </CollapsibleCard>
  );
}
