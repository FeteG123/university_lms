-- Reset all demo users to password "demo1234" (run if login returns 401).
UPDATE users
SET password_hash = '$2b$12$4rU24r0vtiSdcc6GoF9UY.zT//dYmO6.XiKFwpPN8jiS6H2atUsv6',
    is_active = true
WHERE email IN (
  'student@example.edu',
  'instructor@example.edu',
  'admin@example.edu'
);
