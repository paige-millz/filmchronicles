-- Fix infinite recursion in photos RLS policies
-- Drop existing SELECT policies that might be causing recursion
DROP POLICY IF EXISTS "Users can view their own photos" ON photos;
DROP POLICY IF EXISTS "Users can view shared photos" ON photos;

-- Recreate clean policies without recursion
CREATE POLICY "Users can view their own photos"
ON photos
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Users can view shared photos"
ON photos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM photo_shares
    WHERE photo_shares.photo_id = photos.id
    AND photo_shares.shared_with_user_id = auth.uid()
  )
);