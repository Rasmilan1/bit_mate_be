-- Supabase Database Schema Migration for BITMATE

-- 1. Create semesters table
CREATE TABLE IF NOT EXISTS public.semesters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  order_index INT DEFAULT 1,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Update subjects table
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject_number TEXT DEFAULT '',
  week_info TEXT DEFAULT '',
  color TEXT DEFAULT '#4f46e5',
  semester_id UUID REFERENCES public.semesters(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS semester_id UUID REFERENCES public.semesters(id) ON DELETE SET NULL;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS subject_number TEXT DEFAULT '';
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS week_info TEXT DEFAULT '';
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#4f46e5';

-- 3. Update materials table
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  week_info TEXT DEFAULT '',
  file_url TEXT DEFAULT '',
  file_path TEXT DEFAULT '',
  file_size BIGINT DEFAULT 0,
  total_pages INT DEFAULT 1,
  current_page INT DEFAULT 1,
  status TEXT DEFAULT 'unread',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS week_info TEXT DEFAULT '';
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS file_url TEXT DEFAULT '';
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS file_path TEXT DEFAULT '';
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS total_pages INT DEFAULT 1;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS current_page INT DEFAULT 1;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'unread';
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 4. Enable RLS and Create Policies for Public Access
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read semesters" ON public.semesters;
DROP POLICY IF EXISTS "Allow public all semesters" ON public.semesters;
CREATE POLICY "Allow public all semesters" ON public.semesters FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read subjects" ON public.subjects;
DROP POLICY IF EXISTS "Allow public all subjects" ON public.subjects;
CREATE POLICY "Allow public all subjects" ON public.subjects FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read materials" ON public.materials;
DROP POLICY IF EXISTS "Allow public all materials" ON public.materials;
CREATE POLICY "Allow public all materials" ON public.materials FOR ALL USING (true) WITH CHECK (true);

-- 5. Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('study-pdfs', 'study-pdfs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Read Access on study-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload Access on study-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Access on study-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Access on storage" ON storage.objects;

CREATE POLICY "Public Read Access on study-pdfs" ON storage.objects FOR SELECT USING (bucket_id = 'study-pdfs');
CREATE POLICY "Public Upload Access on study-pdfs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'study-pdfs');
CREATE POLICY "Public Update Access on study-pdfs" ON storage.objects FOR UPDATE USING (bucket_id = 'study-pdfs');
CREATE POLICY "Public Delete Access on storage" ON storage.objects FOR DELETE USING (bucket_id = 'study-pdfs');
