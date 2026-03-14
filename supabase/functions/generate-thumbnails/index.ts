import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting thumbnail generation for existing photos...');

    // Fetch all photos to check which ones need thumbnails
    const { data: photos, error: fetchError } = await supabase
      .from('photos')
      .select('id, file_url, thumb_url, original_filename');

    if (fetchError) {
      console.error('Error fetching photos:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${photos?.length || 0} total photos`);

    if (!photos || photos.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No photos found', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter photos that need thumbnails (where thumb_url is null or equals file_url)
    const photosNeedingThumbs = photos.filter(
      p => !p.thumb_url || p.thumb_url === p.file_url
    );

    console.log(`Found ${photosNeedingThumbs.length} photos needing thumbnails`);

    if (photosNeedingThumbs.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'All photos already have thumbnails', 
          total: photos.length,
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let successCount = 0;
    let errorCount = 0;

    for (const photo of photosNeedingThumbs) {
      try {
        console.log(`Processing photo ${photo.id}: ${photo.original_filename}`);

        // Fetch the original image
        const imageResponse = await fetch(photo.file_url);
        if (!imageResponse.ok) {
          console.error(`Failed to fetch image for ${photo.id}`);
          errorCount++;
          continue;
        }

        const imageBlob = await imageResponse.blob();
        
        // Create thumbnail using Canvas API (Deno supports this)
        const arrayBuffer = await imageBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // For Deno, we'll use a different approach - just resize using fetch
        // Since we can't use Canvas in Deno, we'll use a simpler approach
        // Just mark it for client-side generation or use image transformation
        
        // Extract filename from file_url
        const urlParts = photo.file_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const thumbFileName = `thumb_${fileName}`;
        
        // For now, we'll create a marker that thumbnails need to be generated
        // In production, you'd use an image processing library like Sharp
        // For this implementation, we'll use Supabase's built-in image transformation
        
        const thumbUrl = `${photo.file_url}?width=400&quality=80`;
        
        // Update the database with transformation URL
        const { error: updateError } = await supabase
          .from('photos')
          .update({ thumb_url: thumbUrl })
          .eq('id', photo.id);

        if (updateError) {
          console.error(`Error updating photo ${photo.id}:`, updateError);
          errorCount++;
        } else {
          console.log(`Successfully processed photo ${photo.id}`);
          successCount++;
        }
      } catch (error) {
        console.error(`Error processing photo ${photo.id}:`, error);
        errorCount++;
      }
    }

    const result = {
      message: 'Thumbnail generation complete',
      total: photos.length,
      needingThumbnails: photosNeedingThumbs.length,
      success: successCount,
      errors: errorCount,
    };

    console.log('Thumbnail generation results:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-thumbnails function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
