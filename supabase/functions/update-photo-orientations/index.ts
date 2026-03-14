import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get auth user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Updating photo orientations for user: ${user.id}`)

    // Fetch all photos owned by this user
    const { data: photos, error: fetchError } = await supabase
      .from('photos')
      .select('id, file_url, orientation')
      .eq('owner_id', user.id)

    if (fetchError) {
      console.error('Error fetching photos:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch photos', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${photos.length} photos to process`)

    let updated = 0
    let skipped = 0
    let errors = 0

    for (const photo of photos) {
      try {
        console.log(`Processing photo ${photo.id}...`)
        
        // Fetch the image
        const imageResponse = await fetch(photo.file_url)
        if (!imageResponse.ok) {
          console.error(`Failed to fetch image ${photo.id}`)
          errors++
          continue
        }

        const imageBlob = await imageResponse.blob()
        const imageBitmap = await createImageBitmap(imageBlob)
        
        const width = imageBitmap.width
        const height = imageBitmap.height
        
        console.log(`Photo ${photo.id} dimensions: ${width}x${height}`)

        let orientation = 'landscape'
        if (height > width) {
          orientation = 'portrait'
        } else if (height === width) {
          orientation = 'square'
        }

        // Only update if orientation changed
        if (orientation !== photo.orientation) {
          const { error: updateError } = await supabase
            .from('photos')
            .update({ orientation })
            .eq('id', photo.id)

          if (updateError) {
            console.error(`Error updating photo ${photo.id}:`, updateError)
            errors++
          } else {
            console.log(`Updated photo ${photo.id} to ${orientation}`)
            updated++
          }
        } else {
          console.log(`Photo ${photo.id} already has correct orientation: ${orientation}`)
          skipped++
        }

        imageBitmap.close()
      } catch (error) {
        console.error(`Error processing photo ${photo.id}:`, error)
        errors++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Photo orientations updated',
        total: photos.length,
        updated,
        skipped,
        errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in update-photo-orientations function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
