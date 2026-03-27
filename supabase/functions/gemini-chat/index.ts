
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Use the latest Gemini Flash model - update this string when newer models are available
// Check https://ai.google.dev/gemini-api/docs/models for the latest model IDs
const GEMINI_MODEL = 'gemini-3.1-flash'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, tripContext, config } = await req.json()

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      throw new Error('Gemini API key not configured')
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: message
            }]
          }],
          tools: [{
            google_search_retrieval: {
              dynamic_retrieval_config: {
                mode: "MODE_DYNAMIC",
                dynamic_threshold: 0.3
              }
            }
          }],
          generationConfig: config || {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Gemini API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response format from Gemini API')
    }

    const candidate = data.candidates[0]
    const aiResponse = candidate.content.parts[0].text
    const groundingMetadata = candidate.groundingMetadata || null

    return new Response(
      JSON.stringify({
        response: aiResponse,
        groundingMetadata,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
