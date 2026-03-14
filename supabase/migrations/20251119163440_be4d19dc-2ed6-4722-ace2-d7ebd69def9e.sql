-- Create security definer functions to prevent RLS recursion

-- Function to check if user owns a photo
CREATE OR REPLACE FUNCTION public.user_owns_photo(_user_id uuid, _photo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.photos
    WHERE id = _photo_id AND owner_id = _user_id
  )
$$;

-- Function to check if photo is shared with user
CREATE OR REPLACE FUNCTION public.photo_is_shared_with_user(_user_id uuid, _photo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.photo_shares
    WHERE photo_id = _photo_id AND shared_with_user_id = _user_id
  )
$$;

-- Function to check if user can view photo (owns OR shared with)
CREATE OR REPLACE FUNCTION public.user_can_view_photo(_user_id uuid, _photo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_owns_photo(_user_id, _photo_id) 
    OR public.photo_is_shared_with_user(_user_id, _photo_id)
$$;

-- Drop all existing problematic policies
DROP POLICY IF EXISTS "Users can view their own photos" ON photos;
DROP POLICY IF EXISTS "Users can view shared photos" ON photos;
DROP POLICY IF EXISTS "Users can insert their own photos" ON photos;
DROP POLICY IF EXISTS "Users can update their own photos" ON photos;
DROP POLICY IF EXISTS "Users can delete their own photos" ON photos;

DROP POLICY IF EXISTS "Owners can view their photo shares" ON photo_shares;
DROP POLICY IF EXISTS "Owners can share their photos" ON photo_shares;
DROP POLICY IF EXISTS "Owners can delete shares" ON photo_shares;

DROP POLICY IF EXISTS "Users can view likes on accessible photos" ON photo_likes;
DROP POLICY IF EXISTS "Users can like accessible photos" ON photo_likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON photo_likes;

DROP POLICY IF EXISTS "Users can view comments on accessible photos" ON photo_comments;
DROP POLICY IF EXISTS "Users can comment on accessible photos" ON photo_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON photo_comments;

-- Recreate photos policies using security definer functions
CREATE POLICY "Users can view their own photos"
ON photos FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Users can view shared photos"
ON photos FOR SELECT
TO authenticated
USING (public.photo_is_shared_with_user(auth.uid(), id));

CREATE POLICY "Users can insert their own photos"
ON photos FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own photos"
ON photos FOR UPDATE
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own photos"
ON photos FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- Recreate photo_shares policies
CREATE POLICY "Owners can view their photo shares"
ON photo_shares FOR SELECT
TO authenticated
USING (public.user_owns_photo(auth.uid(), photo_id));

CREATE POLICY "Owners can share their photos"
ON photo_shares FOR INSERT
TO authenticated
WITH CHECK (public.user_owns_photo(auth.uid(), photo_id));

CREATE POLICY "Owners can delete shares"
ON photo_shares FOR DELETE
TO authenticated
USING (public.user_owns_photo(auth.uid(), photo_id));

-- Recreate photo_likes policies
CREATE POLICY "Users can view likes on accessible photos"
ON photo_likes FOR SELECT
TO authenticated
USING (public.user_can_view_photo(auth.uid(), photo_id));

CREATE POLICY "Users can like accessible photos"
ON photo_likes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND public.user_can_view_photo(auth.uid(), photo_id)
);

CREATE POLICY "Users can delete their own likes"
ON photo_likes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Recreate photo_comments policies
CREATE POLICY "Users can view comments on accessible photos"
ON photo_comments FOR SELECT
TO authenticated
USING (public.user_can_view_photo(auth.uid(), photo_id));

CREATE POLICY "Users can comment on accessible photos"
ON photo_comments FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND public.user_can_view_photo(auth.uid(), photo_id)
);

CREATE POLICY "Users can delete own comments"
ON photo_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);