-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles are viewable by authenticated users
CREATE POLICY "Profiles viewable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$;

-- Trigger to auto-create profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add owner_id to photos table
ALTER TABLE public.photos ADD COLUMN owner_id UUID REFERENCES public.profiles(id);

-- Update existing photos to have an owner (you'll need to set this manually)
-- For now, we'll allow null but you should assign ownership later

-- Create photo_shares table for private sharing
CREATE TABLE public.photo_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(photo_id, shared_with_user_id)
);

ALTER TABLE public.photo_shares ENABLE ROW LEVEL SECURITY;

-- Photo owners can share their photos
CREATE POLICY "Owners can share their photos"
ON public.photo_shares FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.photos
    WHERE id = photo_id AND owner_id = auth.uid()
  )
);

-- Photo owners can view shares
CREATE POLICY "Owners can view their photo shares"
ON public.photo_shares FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.photos
    WHERE id = photo_id AND owner_id = auth.uid()
  )
);

-- Photo owners can delete shares
CREATE POLICY "Owners can delete shares"
ON public.photo_shares FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.photos
    WHERE id = photo_id AND owner_id = auth.uid()
  )
);

-- Create likes table
CREATE TABLE public.photo_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(photo_id, user_id)
);

ALTER TABLE public.photo_likes ENABLE ROW LEVEL SECURITY;

-- Users can like photos they have access to
CREATE POLICY "Users can like accessible photos"
ON public.photo_likes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND (
    EXISTS (SELECT 1 FROM public.photos WHERE id = photo_id AND owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.photo_shares WHERE photo_id = photo_likes.photo_id AND shared_with_user_id = auth.uid())
  )
);

-- Users can view likes on accessible photos
CREATE POLICY "Users can view likes on accessible photos"
ON public.photo_likes FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.photos WHERE id = photo_id AND owner_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.photo_shares WHERE photo_id = photo_likes.photo_id AND shared_with_user_id = auth.uid())
);

-- Users can unlike their own likes
CREATE POLICY "Users can delete their own likes"
ON public.photo_likes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create comments table
CREATE TABLE public.photo_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.photo_comments ENABLE ROW LEVEL SECURITY;

-- Users can comment on photos they have access to
CREATE POLICY "Users can comment on accessible photos"
ON public.photo_comments FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND (
    EXISTS (SELECT 1 FROM public.photos WHERE id = photo_id AND owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.photo_shares WHERE photo_id = photo_comments.photo_id AND shared_with_user_id = auth.uid())
  )
);

-- Users can view comments on accessible photos
CREATE POLICY "Users can view comments on accessible photos"
ON public.photo_comments FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.photos WHERE id = photo_id AND owner_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.photo_shares WHERE photo_id = photo_comments.photo_id AND shared_with_user_id = auth.uid())
);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
ON public.photo_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Update photos RLS policies for private sharing
DROP POLICY IF EXISTS "Allow public read access" ON public.photos;
DROP POLICY IF EXISTS "Allow public insert" ON public.photos;
DROP POLICY IF EXISTS "Allow public update" ON public.photos;
DROP POLICY IF EXISTS "Allow public delete" ON public.photos;

-- New RLS policies for photos
CREATE POLICY "Users can view their own photos"
ON public.photos FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Users can view shared photos"
ON public.photos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.photo_shares
    WHERE photo_id = photos.id AND shared_with_user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own photos"
ON public.photos FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own photos"
ON public.photos FOR UPDATE
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own photos"
ON public.photos FOR DELETE
TO authenticated
USING (owner_id = auth.uid());