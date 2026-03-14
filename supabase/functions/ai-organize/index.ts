import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { photo_ids } = await req.json();
    if (!photo_ids || !Array.isArray(photo_ids) || photo_ids.length === 0) {
      throw new Error("photo_ids array is required");
    }

    // Fetch photos (only user's own photos)
    const { data: photos, error: fetchError } = await supabase
      .from("photos")
      .select("id, thumb_url, file_url")
      .in("id", photo_ids)
      .eq("owner_id", user.id);

    if (fetchError) throw fetchError;
    if (!photos || photos.length === 0) throw new Error("No photos found");

    const results: Array<{ id: string; shoot_type: string; recipe: string; tags: string[] }> = [];

    // Process in batches of 5
    for (let i = 0; i < photos.length; i += 5) {
      const batch = photos.slice(i, i + 5);
      const batchResults = await Promise.all(
        batch.map(async (photo) => {
          const imageUrl = photo.thumb_url || photo.file_url;

          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a photography expert. Analyze photos and categorize them. You must call the classify_photo function with your analysis.",
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Analyze this photo. Determine the shoot type, suggest a Fujifilm film simulation recipe name, and generate 3-5 descriptive tags.",
                    },
                    {
                      type: "image_url",
                      image_url: { url: imageUrl },
                    },
                  ],
                },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "classify_photo",
                    description: "Classify a photo with shoot type, recipe suggestion, and tags",
                    parameters: {
                      type: "object",
                      properties: {
                        shoot_type: {
                          type: "string",
                          enum: ["street", "landscape", "portraits", "travel", "christmas", "architecture", "nature", "food", "events", "other"],
                          description: "The type of photography shoot",
                        },
                        recipe: {
                          type: "string",
                          description: "A Fujifilm film simulation recipe name (e.g. 'Classic Neg', 'Kodak Portra 400', 'Nostalgic Neg', 'Provia', 'Velvia', 'Classic Chrome', 'Eterna', 'Acros')",
                        },
                        tags: {
                          type: "array",
                          items: { type: "string" },
                          description: "3-5 descriptive keyword tags for the photo",
                        },
                      },
                      required: ["shoot_type", "recipe", "tags"],
                      additionalProperties: false,
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "classify_photo" } },
            }),
          });

          if (!response.ok) {
            const status = response.status;
            const text = await response.text();
            if (status === 429) throw new Error("RATE_LIMITED");
            if (status === 402) throw new Error("PAYMENT_REQUIRED");
            console.error(`AI error for photo ${photo.id}:`, status, text);
            throw new Error(`AI error: ${status}`);
          }

          const data = await response.json();
          const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

          if (!toolCall) {
            console.error("No tool call in response for photo", photo.id);
            return null;
          }

          const args = JSON.parse(toolCall.function.arguments);
          return { id: photo.id, ...args };
        })
      );

      results.push(...batchResults.filter(Boolean));
    }

    // Update all photos in DB
    for (const result of results) {
      await supabase
        .from("photos")
        .update({
          shoot_type: result.shoot_type,
          recipe: result.recipe,
          tags: result.tags,
        })
        .eq("id", result.id);
    }

    return new Response(
      JSON.stringify({ success: true, updated: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ai-organize error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";

    if (message === "RATE_LIMITED") {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (message === "PAYMENT_REQUIRED") {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in your workspace settings." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
