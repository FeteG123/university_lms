-- Reset all demo users to password "demo1234" (run if login returns 401).
UPDATE users
SET password_hash = '$2b$12$4rU24r0vtiSdcc6GoF9UY.zT//dYmO6.XiKFwpPN8jiS6H2atUsv6',
    is_active = true
WHERE email IN (
  'admin@example.edu',
  'instructor@example.edu',
  'prof2@example.edu',
  'prof3@example.edu',
  'student@example.edu',
  'student2@example.edu',
  'student3@example.edu',
  'student4@example.edu',
  'student5@example.edu'
);
