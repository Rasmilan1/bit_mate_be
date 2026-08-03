-- =================================================================
-- BITMAT STUDY HUB - SUPABASE SQL DATABASE SCHEMA ($0 FREE TIER)
-- Copy and paste this script into your Supabase Project SQL Editor
-- =================================================================

-- 0. Create Semesters Table
CREATE TABLE IF NOT EXISTS public.semesters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER DEFAULT 1,
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1. Create Subjects Table
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    semester_id UUID REFERENCES public.semesters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subject_number TEXT DEFAULT '',
    week_info TEXT DEFAULT '',
    color TEXT DEFAULT '#3b82f6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS subject_number TEXT DEFAULT '';
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS week_info TEXT DEFAULT '';

-- 2. Create Materials Table (PDF metadata & study progress)
-- ON DELETE CASCADE removes all PDFs when their subject is deleted
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    week_info TEXT DEFAULT '',
    file_url TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT DEFAULT 0,
    total_pages INTEGER DEFAULT 1,
    current_page INTEGER DEFAULT 1,
    status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'in_progress', 'completed')),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS week_info TEXT DEFAULT '';

-- 3. Create Study Notes Table (Side-by-side markdown notes per PDF)
CREATE TABLE IF NOT EXISTS public.study_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID UNIQUE REFERENCES public.materials(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_notes ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies for Multi-Device User Isolation
CREATE POLICY "Allow public select for semesters" ON public.semesters FOR SELECT USING (true);
CREATE POLICY "Allow public insert for semesters" ON public.semesters FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update for semesters" ON public.semesters FOR UPDATE USING (true);
CREATE POLICY "Allow public delete for semesters" ON public.semesters FOR DELETE USING (true);

CREATE POLICY "Allow public select for subjects" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "Allow public insert for subjects" ON public.subjects FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete for subjects" ON public.subjects FOR DELETE USING (true);

CREATE POLICY "Allow public select for materials" ON public.materials FOR SELECT USING (true);
CREATE POLICY "Allow public insert for materials" ON public.materials FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update for materials" ON public.materials FOR UPDATE USING (true);
CREATE POLICY "Allow public delete for materials" ON public.materials FOR DELETE USING (true);

CREATE POLICY "Allow public select for study_notes" ON public.study_notes FOR SELECT USING (true);
CREATE POLICY "Allow public upsert for study_notes" ON public.study_notes FOR ALL USING (true);

-- 6. Setup Supabase Storage Bucket 'study-pdfs'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('study-pdfs', 'study-pdfs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access for PDFs" ON storage.objects FOR SELECT USING (bucket_id = 'study-pdfs');
CREATE POLICY "Public Upload for PDFs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'study-pdfs');
CREATE POLICY "Public Delete for PDFs" ON storage.objects FOR DELETE USING (bucket_id = 'study-pdfs');
