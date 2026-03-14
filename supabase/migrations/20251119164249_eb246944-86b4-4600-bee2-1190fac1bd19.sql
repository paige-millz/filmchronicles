-- Add orientation column to photos table
ALTER TABLE public.photos ADD COLUMN orientation text DEFAULT 'landscape';