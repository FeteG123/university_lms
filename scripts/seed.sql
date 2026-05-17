-- Demo data (password for all users: demo1234)
-- bcrypt: $2b$12$4rU24r0vtiSdcc6GoF9UY.zT//dYmO6.XiKFwpPN8jiS6H2atUsv6
--
-- Accounts:
--   admin@example.edu
--   instructor@example.edu, prof2@example.edu, prof3@example.edu  (lecturers)
--   student@example.edu … student5@example.edu                    (students)

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
INSERT INTO users (email, full_name, password_hash, role)
VALUES
  ('admin@example.edu', 'Admin User', '$2b$12$4rU24r0vtiSdcc6GoF9UY.zT//dYmO6.XiKFwpPN8jiS6H2atUsv6', 'admin'),
  ('instructor@example.edu', 'Dr. Bob Chen', '$2b$12$4rU24r0vtiSdcc6GoF9UY.zT//dYmO6.XiKFwpPN8jiS6H2atUsv6', 'lecturer'),
  ('prof2@example.edu', 'Dr. Elena Vasquez', '$2b$12$4rU24r0vtiSdcc6GoF9UY.zT//dYmO6.XiKFwpPN8jiS6H2atUsv6', 'lecturer'),
  ('prof3@example.edu', 'Dr. James Okonkwo', '$2b$12$4rU24r0vtiSdcc6GoF9UY.zT//dYmO6.XiKFwpPN8jiS6H2atUsv6', 'lecturer'),
  ('student@example.edu', 'Ada Lovelace', '$2b$12$4rU24r0vtiSdcc6GoF9UY.zT//dYmO6.XiKFwpPN8jiS6H2atUsv6', 'student'),
  ('student2@example.edu', 'Ben Turing', '$2b$12$4rU24r0vtiSdcc6GoF9UY.zT//dYmO6.XiKFwpPN8jiS6H2atUsv6', 'student'),
  ('student3@example.edu', 'Clara Hopper', '$2b$12$4rU24r0vtiSdcc6GoF9UY.zT//dYmO6.XiKFwpPN8jiS6H2atUsv6', 'student'),
  ('student4@example.edu', 'Diego Garcia', '$2b$12$4rU24r0vtiSdcc6GoF9UY.zT//dYmO6.XiKFwpPN8jiS6H2atUsv6', 'student'),
  ('student5@example.edu', 'Emma Wilson', '$2b$12$4rU24r0vtiSdcc6GoF9UY.zT//dYmO6.XiKFwpPN8jiS6H2atUsv6', 'student')
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  is_active = true;

-- ---------------------------------------------------------------------------
-- Courses (6 courses; 4 with assignments, 2 without)
-- ---------------------------------------------------------------------------
INSERT INTO courses (code, title, description, instructor_id)
SELECT v.code, v.title, v.description, u.id
FROM (VALUES
  ('CS301', 'Database Systems', 'Relational design, SQL, and the group LMS project.', 'instructor@example.edu'),
  ('CS210', 'Data Structures', 'Lists, trees, graphs, and complexity analysis.', 'prof2@example.edu'),
  ('MATH201', 'Linear Algebra', 'Vectors, matrices, eigenvalues  - no coursework portal yet.', 'prof2@example.edu'),
  ('EE101', 'Circuit Analysis', 'DC circuits, Kirchhoff laws, and lab reports.', 'prof3@example.edu'),
  ('CS401', 'Capstone Project', 'Team software project with milestones and demo.', 'prof3@example.edu'),
  ('HIST105', 'Modern World History', 'Lecture-only survey course for enrollment demos.', 'instructor@example.edu')
) AS v(code, title, description, instructor_email)
JOIN users u ON u.email = v.instructor_email
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  instructor_id = EXCLUDED.instructor_id;

-- ---------------------------------------------------------------------------
-- Enrollments
-- ---------------------------------------------------------------------------
INSERT INTO enrollments (user_id, course_id)
SELECT s.id, c.id
FROM users s
JOIN courses c ON (
  (c.code = 'CS301' AND s.email IN (
    'student@example.edu', 'student2@example.edu', 'student3@example.edu',
    'student4@example.edu', 'student5@example.edu'))
  OR (c.code = 'CS210' AND s.email IN (
    'student@example.edu', 'student2@example.edu', 'student3@example.edu'))
  OR (c.code = 'MATH201' AND s.email IN (
    'student@example.edu', 'student4@example.edu', 'student5@example.edu'))
  OR (c.code = 'EE101' AND s.email IN (
    'student2@example.edu', 'student3@example.edu', 'student4@example.edu', 'student5@example.edu'))
  OR (c.code = 'CS401' AND s.email IN (
    'student3@example.edu', 'student4@example.edu', 'student5@example.edu'))
  OR (c.code = 'HIST105' AND s.email IN ('student@example.edu', 'student2@example.edu'))
)
WHERE s.role = 'student'
ON CONFLICT (user_id, course_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Assignments
-- ---------------------------------------------------------------------------
INSERT INTO assignments (course_id, title, description, due_at)
SELECT c.id, v.title, v.description, v.due_at::timestamptz
FROM courses c
JOIN (VALUES
  ('CS301', 'Phase 1  - architecture', 'ER diagram, service boundaries, and compose stack.', '2026-06-01 23:59:00+00'),
  ('CS301', 'Phase 2  - implementation', 'Working API, UI, plagiarism worker, and observability.', '2026-06-15 23:59:00+00'),
  ('CS210', 'Homework 3  - binary search trees', 'Implement insert, search, and in-order traversal.', '2026-05-25 23:59:00+00'),
  ('CS210', 'Midterm lab', 'Open-book practical in the lab room.', '2026-05-20 14:00:00+00'),
  ('EE101', 'Lab 1  - Ohm''s law', 'Measure resistors and submit calculations.', '2026-05-18 23:59:00+00'),
  ('CS401', 'Project proposal', 'One-page PDF outline and team roster.', '2026-05-22 23:59:00+00'),
  ('CS401', 'Final demo', 'Live demo and repository link.', '2026-06-20 23:59:00+00')
) AS v(course_code, title, description, due_at)
  ON c.code = v.course_code
WHERE NOT EXISTS (
  SELECT 1 FROM assignments a
  WHERE a.course_id = c.id AND a.title = v.title
);

-- ---------------------------------------------------------------------------
-- Submissions (one per student per assignment)
-- ---------------------------------------------------------------------------
INSERT INTO submissions (
  public_id, assignment_id, student_id, body_text,
  plagiarism_status, plagiarism_score, created_at, updated_at
)
SELECT v.public_id, a.id, s.id, v.body_text, v.plagiarism_status, v.plagiarism_score, now(), now()
FROM (VALUES
  ('CS301', 'Phase 1  - architecture', 'student@example.edu', 9000000000000000001::bigint,
   'ER: users, courses, enrollments, assignments, submissions, grades. Traefik + 2 API replicas.',
   'completed', 0.04),
  ('CS301', 'Phase 1  - architecture', 'student2@example.edu', 9000000000000000002::bigint,
   'Draft architecture with Postgres and Redis. Celery worker for plagiarism.',
   'completed', 0.12),
  ('CS301', 'Phase 1  - architecture', 'student3@example.edu', 9000000000000000003::bigint,
   'Component diagram attached in repo docs folder.',
   'completed', 0.08),
  ('CS301', 'Phase 2  - implementation', 'student@example.edu', 9000000000000000004::bigint,
   'MVP deployed locally with docker compose; JWT auth and grades CSV export.',
   'pending', NULL),
  ('CS301', 'Phase 2  - implementation', 'student2@example.edu', 9000000000000000005::bigint,
   'API and React UI wired; working on observability stack.',
   'pending', NULL),
  ('CS210', 'Homework 3  - binary search trees', 'student@example.edu', 9000000000000000006::bigint,
   'BST implementation in Python with unit tests.',
   'completed', 0.02),
  ('CS210', 'Homework 3  - binary search trees', 'student2@example.edu', 9000000000000000007::bigint,
   'Submitted Java solution; O(log n) search verified.',
   'completed', 0.05),
  ('EE101', 'Lab 1  - Ohm''s law', 'student3@example.edu', 9000000000000000008::bigint,
   'Measured R=220Ω, V=5V, I=22.7mA. Within 2% of calculated value.',
   'completed', 0.01),
  ('EE101', 'Lab 1  - Ohm''s law', 'student4@example.edu', 9000000000000000009::bigint,
   'Table of three resistors and computed currents.',
   'completed', 0.03),
  ('CS401', 'Project proposal', 'student3@example.edu', 9000000000000000010::bigint,
   'Smart campus navigation app  - team: Clara, Diego, Emma.',
   'completed', 0.00),
  ('CS401', 'Project proposal', 'student4@example.edu', 9000000000000000011::bigint,
   'IoT parking sensor network with mobile dashboard.',
   'pending', NULL),
  ('CS401', 'Project proposal', 'student5@example.edu', 9000000000000000012::bigint,
   'Peer tutoring marketplace with video rooms.',
   'pending', NULL)
) AS v(course_code, assignment_title, student_email, public_id, body_text, plagiarism_status, plagiarism_score)
JOIN courses c ON c.code = v.course_code
JOIN assignments a ON a.course_id = c.id AND a.title = v.assignment_title
JOIN users s ON s.email = v.student_email
WHERE NOT EXISTS (
  SELECT 1 FROM submissions sub
  WHERE sub.assignment_id = a.id AND sub.student_id = s.id
);

-- ---------------------------------------------------------------------------
-- Grades (sample graded work)
-- ---------------------------------------------------------------------------
INSERT INTO grades (submission_id, score, letter_grade, feedback, graded_by)
SELECT sub.id, v.score, v.letter_grade, v.feedback, p.id
FROM (VALUES
  ('CS301', 'Phase 1  - architecture', 'student@example.edu', 92.00, 'A', 'Clear ER and deployment diagram.'),
  ('CS301', 'Phase 1  - architecture', 'student2@example.edu', 88.50, 'B+', 'Solid stack choice; expand threat model.'),
  ('CS301', 'Phase 1  - architecture', 'student3@example.edu', 90.00, 'A-', 'Good component boundaries.'),
  ('EE101', 'Lab 1  - Ohm''s law', 'student3@example.edu', 95.00, 'A', 'Measurements and analysis are excellent.'),
  ('EE101', 'Lab 1  - Ohm''s law', 'student4@example.edu', 82.00, 'B', 'Check significant figures on row 2.')
) AS v(course_code, assignment_title, student_email, score, letter_grade, feedback)
JOIN courses c ON c.code = v.course_code
JOIN assignments a ON a.course_id = c.id AND a.title = v.assignment_title
JOIN users s ON s.email = v.student_email
JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = s.id
JOIN courses c2 ON c2.id = a.course_id
JOIN users p ON p.id = c2.instructor_id
WHERE NOT EXISTS (SELECT 1 FROM grades g WHERE g.submission_id = sub.id);

-- ---------------------------------------------------------------------------
-- Chat rooms (one per course) + sample messages
-- ---------------------------------------------------------------------------
INSERT INTO chat_rooms (course_id)
SELECT c.id FROM courses c
WHERE NOT EXISTS (SELECT 1 FROM chat_rooms r WHERE r.course_id = c.id);

INSERT INTO chat_messages (room_id, sender_id, content)
SELECT r.id, u.id, v.content
FROM (VALUES
  ('CS301', 'instructor@example.edu', 'Welcome to Database Systems  - ask questions here during lectures.'),
  ('CS210', 'prof2@example.edu', 'Homework 3 is posted; office hours Thursday 14:00.'),
  ('CS401', 'prof3@example.edu', 'Form teams of 3 and confirm your proposal topic by Friday.')
) AS v(course_code, sender_email, content)
JOIN courses c ON c.code = v.course_code
JOIN chat_rooms r ON r.course_id = c.id
JOIN users u ON u.email = v.sender_email
WHERE NOT EXISTS (
  SELECT 1 FROM chat_messages m
  WHERE m.room_id = r.id AND m.sender_id = u.id AND m.content = v.content
);
