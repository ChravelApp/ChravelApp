export function requireServiceRole(
  req: Request,
  corsHeaders: Record<string, string>,
): { authorized: true; response: null } | { authorized: false; response: Response } {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return {
      authorized: false,
      response: new Response(JSON.stringify({ success: false, error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    };
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const token = authHeader.replace('Bearer ', '');

  if (!serviceRoleKey || token !== serviceRoleKey) {
    return {
      authorized: false,
      response: new Response(
        JSON.stringify({ success: false, error: 'Admin access required — use service role key' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      ),
    };
  }

  return { authorized: true, response: null };
}
