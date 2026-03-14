-- Add policy to allow all authenticated users to view all photos
CREATE POLICY "Authenticated users can view all photos" 
ON public.photos 
FOR SELECT 
TO authenticated
USING (true);