import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VERTEX_WS_PATH =
  'google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent'

// Rate limiting: in-memory store (per isolate)
const sessionTimestamps: Map<string, number[]> = new Map()
const MAX_SESSIONS_PER_WINDOW = 10
const RATE_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const upgrade = req.headers.get('upgrade') || ''
  if (upgrade.toLowerCase() === 'websocket') {
    return handleProxyWebSocket(req)
  }

  try {
    const { user_id } = await req.json()

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Rate limiting ────────────────────────────────────────────
    const now = Date.now()
    const userSessions = sessionTimestamps.get(user_id) || []
    const recentSessions = userSessions.filter((t) => now - t < RATE_WINDOW_MS)

    if (recentSessions.length >= MAX_SESSIONS_PER_WINDOW) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please wait a few minutes.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    recentSessions.push(now)
    sessionTimestamps.set(user_id, recentSessions)

    // ── Load config ──────────────────────────────────────────────
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')
    const projectId = Deno.env.get('VERTEX_PROJECT_ID')
    const location = Deno.env.get('VERTEX_LOCATION') || 'us-central1'

    if (!serviceAccountJson || !projectId) {
      throw new Error('Missing Vertex AI configuration')
    }

    // ── Build session config ─────────────────────────────────────
    const model = 'gemini-live-2.5-flash-native-audio'
    const websocketUrl = buildProxyWebSocketUrl(req.url)

    const setupMessage = {
      setup: {
        model: `projects/${projectId}/locations/${location}/publishers/google/models/${model}`,
        generation_config: {
          response_modalities: ['AUDIO'],
          speech_config: {
            voice_config: {
              prebuilt_voice_config: {
                voice_name: 'Aoede',
              },
            },
          },
          temperature: 0.7,
          max_output_tokens: 2048,
        },
        system_instruction: {
          parts: [
            {
              text: `You are a friendly and knowledgeable travel concierge assistant for ChravelApp, a group trip planning platform. You help users plan trips, find flights, hotels, restaurants, and activities. Keep responses concise and conversational since this is a voice interaction. Be warm, enthusiastic about travel, and helpful. When discussing specific places, mention key details like ratings, prices, and what makes them special.`,
            },
          ],
        },
      },
    }

    return new Response(
      JSON.stringify({
        websocketUrl,
        setupMessage,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    console.error('Voice session error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleProxyWebSocket(req: Request): Promise<Response> {
  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')
  const location = Deno.env.get('VERTEX_LOCATION') || 'us-central1'

  if (!serviceAccountJson) {
    return new Response('Missing Vertex AI configuration', { status: 500, headers: corsHeaders })
  }

  const serviceAccount = JSON.parse(serviceAccountJson)
  const accessToken = await getAccessToken(serviceAccount)
  const upstreamUrl = `wss://${location}-aiplatform.googleapis.com/ws/${VERTEX_WS_PATH}`

  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req)
  const upstreamSocket = new WebSocket(upstreamUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const queuedMessages: string[] = []
  let upstreamReady = false
  let socketsClosed = false

  const closeSockets = (reason?: string) => {
    if (socketsClosed) return
    socketsClosed = true

    try {
      if (
        clientSocket.readyState === WebSocket.OPEN ||
        clientSocket.readyState === WebSocket.CONNECTING
      ) {
        clientSocket.close(1000, reason || 'Proxy session closed')
      }
    } catch {
      // Ignore close errors
    }

    try {
      if (
        upstreamSocket.readyState === WebSocket.OPEN ||
        upstreamSocket.readyState === WebSocket.CONNECTING
      ) {
        upstreamSocket.close(1000, reason || 'Proxy session closed')
      }
    } catch {
      // Ignore close errors
    }
  }

  clientSocket.onmessage = (event) => {
    const data = typeof event.data === 'string' ? event.data : String(event.data)
    if (upstreamReady && upstreamSocket.readyState === WebSocket.OPEN) {
      upstreamSocket.send(data)
      return
    }
    queuedMessages.push(data)
  }

  clientSocket.onerror = () => closeSockets('Client websocket error')
  clientSocket.onclose = () => closeSockets()

  upstreamSocket.onopen = () => {
    upstreamReady = true
    while (queuedMessages.length > 0) {
      upstreamSocket.send(queuedMessages.shift()!)
    }
  }

  upstreamSocket.onmessage = (event) => {
    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(event.data)
    }
  }

  upstreamSocket.onerror = () => closeSockets('Upstream websocket error')
  upstreamSocket.onclose = () => closeSockets()

  return response
}

function buildProxyWebSocketUrl(requestUrl: string): string {
  const url = new URL(requestUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

// ── OAuth2 via Service Account JWT ─────────────────────────────────

async function getAccessToken(serviceAccount: {
  client_email: string
  private_key: string
  token_uri?: string
}): Promise<string> {
  const tokenUri = serviceAccount.token_uri || 'https://oauth2.googleapis.com/token'
  const scope = 'https://www.googleapis.com/auth/cloud-platform'

  const now = Math.floor(Date.now() / 1000)
  const jwt = await createSignedJwt(
    {
      iss: serviceAccount.client_email,
      sub: serviceAccount.client_email,
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
      scope,
    },
    serviceAccount.private_key
  )

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Token exchange failed: ${response.status} ${err}`)
  }

  const data = await response.json()
  return data.access_token
}

async function createSignedJwt(
  payload: Record<string, unknown>,
  privateKeyPem: string
): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`

  const keyData = pemToArrayBuffer(privateKeyPem)
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  const encodedSignature = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signature))
  )

  return `${signingInput}.${encodedSignature}`
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN .*-----/, '')
    .replace(/-----END .*-----/, '')
    .replace(/\s/g, '')

  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}
