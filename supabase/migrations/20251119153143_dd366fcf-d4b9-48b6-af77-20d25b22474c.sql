-- Create photos table
CREATE TABLE public.photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_url TEXT NOT NULL,
  thumb_url TEXT,
  original_filename TEXT NOT NULL UNIQUE,
  aperture TEXT,
  shutter_speed TEXT,
  iso INTEGER,
  camera TEXT,
  recipe TEXT,
  capture_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a personal journal)
CREATE POLICY "Allow public read access" 
ON public.photos 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert" 
ON public.photos 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update" 
ON public.photos 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete" 
ON public.photos 
FOR DELETE 
USING (true);

-- Create storage bucket for photo uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('photo-uploads', 'photo-uploads', true);

-- Create storage policies for public access
CREATE POLICY "Allow public uploads" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'photo-uploads');

CREATE POLICY "Allow public access to photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'photo-uploads');

CREATE POLICY "Allow public updates to photos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'photo-uploads');

CREATE POLICY "Allow public deletes" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'photo-uploads');