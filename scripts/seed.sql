-- Demo data (password for all users: demo1234)
-- bcrypt: $2b$12$4rU24r0vtiSdcc6GoF9UY.zT//dYmO6.XiKFwpPN8jiS6H2atUsv6

INSERT INTO users (email, full_name, password_hash, role)
VALUES
  ('student@example.edu', 'Ada Student', '$2b$12$4rU24r0vtiSdcc6GoF9UY.zT//dYmO6.XiKFwpPN8jiS6H2atUsv6', 'student'),
  ('instructor@example.edu', 'Bob Instructor', '$2b$12$4rU24r0vtiSdcc6GoF9UY.zT//dYmO6.XiKFwpPN8jiS6H2atUsv6', 'lecturer'),
  ('admin@example.edu', 'Admin User', '$2b$12$4rU24r0vtiSdcc6GoF9UY.zT//dYmO6.XiKFwpPN8jiS6H2atUsv6', 'admin')
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name;

INSERT INTO courses (code, title, description, instructor_id)
SELECT 'CS301', 'Database Systems', 'Group project LMS-lite', u.id
FROM users u
WHERE u.email = 'instructor@example.edu'
ON CONFLICT (code) DO NOTHING;

INSERT INTO enrollments (user_id, course_id)
SELECT s.id, c.id
FROM users s
JOIN courses c ON c.code = 'CS301'
WHERE s.email = 'student@example.edu'
ON CONFLICT (user_id, course_id) DO NOTHING;

INSERT INTO assignments (course_id, title, description)
SELECT c.id, 'Phase 1 - architecture', 'Design ER, services, and compose stack.'
FROM courses c
WHERE c.code = 'CS301'
  AND NOT EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.course_id = c.id AND a.title = 'Phase 1 - architecture'
  );
