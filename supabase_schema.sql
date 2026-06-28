-- SCHOOL ATTENDANCE SYSTEM SCHEMA

-- 1. Students Table
CREATE TABLE IF NOT EXISTS students (
  student_id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  course TEXT,
  parent_name TEXT NOT NULL,
  parent_mobile TEXT NOT NULL,
  parent_email TEXT NOT NULL,
  address TEXT,
  photo_url TEXT,
  barcode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Teachers Table
CREATE TABLE IF NOT EXISTS teachers (
  employee_id TEXT PRIMARY KEY,
  teacher_name TEXT NOT NULL,
  department TEXT,
  mobile TEXT,
  email TEXT,
  address TEXT,
  photo_url TEXT,
  barcode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Staff Table
CREATE TABLE IF NOT EXISTS staff (
  employee_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT,
  mobile TEXT,
  address TEXT,
  photo_url TEXT,
  barcode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Student Attendance Table
CREATE TABLE IF NOT EXISTS student_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  entry_time TIMESTAMPTZ,
  exit_time TIMESTAMPTZ,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_student_date UNIQUE (student_id, date)
);

-- 5. Staff Attendance Table (covers both Teachers and Staff)
CREATE TABLE IF NOT EXISTS staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,
  employee_type TEXT NOT NULL, -- 'Teacher' or 'Staff'
  date DATE DEFAULT CURRENT_DATE,
  entry_time TIMESTAMPTZ,
  exit_time TIMESTAMPTZ,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_employee_date UNIQUE (employee_id, date)
);

-- 6. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL -- 'Sent', 'Failed'
);

-- 7. Storage Buckets (Run this if you want to create buckets programmatically, or create them via the Supabase Dashboard)
-- Buckets to create in Supabase Storage:
-- - 'student-photos'
-- - 'teacher-photos'
-- - 'staff-photos'
-- Make sure to set these buckets to "Public" so photo URLs can be accessed.

-- 8. Enable Row Level Security (RLS) & Policies
-- For development convenience, you can disable RLS or add broad policies:
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE student_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- If you prefer enabling RLS and adding policies:
/*
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to authenticated users" ON students FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read for scanning" ON students FOR SELECT TO anon USING (true);
*/

-- 9. PostgreSQL Cron Job (Auto-Delete Old Attendance Records after 1 Week)
-- Run this in your Supabase SQL editor to schedule daily cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION delete_old_attendance()
RETURNS void AS $$
BEGIN
  DELETE FROM student_attendance WHERE date < CURRENT_DATE - INTERVAL '7 days';
  DELETE FROM staff_attendance WHERE date < CURRENT_DATE - INTERVAL '7 days';
  DELETE FROM notifications WHERE sent_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule the function to run daily at 00:00 UTC
SELECT cron.schedule(
  'delete-old-attendance-daily',
  '0 0 * * *',
  'SELECT delete_old_attendance()'
);
