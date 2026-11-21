-- ============================================================================
-- MIGRATION V2 (2026-11-21): Classroom Backend RLS (#22) + Issued Cleanup Index (#4)
-- Idempotent 100% — An toàn chạy lại nhiều lần trên Supabase Production.
-- ============================================================================

-- 1. Index tối ưu dọn rác bảng issued_questions chưa trả lời quá 48h
CREATE INDEX IF NOT EXISTS idx_issued_questions_unanswered_created
  ON public.issued_questions (created_at)
  WHERE answered = false;

-- 2. Bảng lớp học của Giáo viên (SAT.Guru Teacher Portal — thay localStorage)
CREATE TABLE IF NOT EXISTS public.classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  target_score integer NOT NULL DEFAULT 1450 CHECK (target_score BETWEEN 400 AND 1600),
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classrooms_teacher_id ON public.classrooms (teacher_id);
CREATE INDEX IF NOT EXISTS idx_classrooms_code ON public.classrooms (code);

-- 3. Bảng thành viên lớp học (Học sinh tham gia bằng Class Code)
CREATE TABLE IF NOT EXISTS public.classroom_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text DEFAULT '',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_classroom_members_classroom ON public.classroom_members (classroom_id);
CREATE INDEX IF NOT EXISTS idx_classroom_members_student ON public.classroom_members (student_id);

-- 4. Bảng bài tập giáo viên giao (bao gồm 1-Click Remedial Homework từ Heatmap)
CREATE TABLE IF NOT EXISTS public.classroom_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  skill_ids text[] NOT NULL DEFAULT '{}',
  question_count integer NOT NULL DEFAULT 10 CHECK (question_count BETWEEN 1 AND 100),
  target_trap_type text,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classroom_assignments_classroom ON public.classroom_assignments (classroom_id);

-- 5. Bảng nộp bài tập của học sinh
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.classroom_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  submitted_at timestamptz,
  UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment ON public.assignment_submissions (assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student ON public.assignment_submissions (student_id);

-- 6. Hàm SECURITY DEFINER phá vỡ đệ quy vòng tròn RLS (tránh PostgreSQL 42P17)
CREATE OR REPLACE FUNCTION public.is_classroom_teacher(p_classroom_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classrooms c
    WHERE c.id = p_classroom_id AND c.teacher_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_classroom_member(p_classroom_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classroom_members m
    WHERE m.classroom_id = p_classroom_id AND m.student_id = auth.uid()
  );
$$;

-- 7. Bật RLS & phân quyền chặt chẽ (0 đệ quy)
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classrooms_teacher_all ON public.classrooms;
CREATE POLICY classrooms_teacher_all ON public.classrooms
  FOR ALL USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS classrooms_member_select ON public.classrooms;
CREATE POLICY classrooms_member_select ON public.classrooms
  FOR SELECT USING (public.is_classroom_member(classrooms.id));

DROP POLICY IF EXISTS classroom_members_student_self ON public.classroom_members;
CREATE POLICY classroom_members_student_self ON public.classroom_members
  FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS classroom_members_teacher_select ON public.classroom_members;
CREATE POLICY classroom_members_teacher_select ON public.classroom_members
  FOR SELECT USING (public.is_classroom_teacher(classroom_members.classroom_id));

DROP POLICY IF EXISTS classroom_assignments_teacher_all ON public.classroom_assignments;
CREATE POLICY classroom_assignments_teacher_all ON public.classroom_assignments
  FOR ALL USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS classroom_assignments_member_select ON public.classroom_assignments;
CREATE POLICY classroom_assignments_member_select ON public.classroom_assignments
  FOR SELECT USING (public.is_classroom_member(classroom_assignments.classroom_id));

DROP POLICY IF EXISTS assignment_submissions_student_all ON public.assignment_submissions;
CREATE POLICY assignment_submissions_student_all ON public.assignment_submissions
  FOR ALL USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS assignment_submissions_teacher_select ON public.assignment_submissions;
CREATE POLICY assignment_submissions_teacher_select ON public.assignment_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.classroom_assignments a
      WHERE a.id = assignment_submissions.assignment_id AND a.teacher_id = auth.uid()
    )
  );
