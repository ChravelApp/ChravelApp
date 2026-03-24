import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('requireServiceRole', () => {
  const envMap = new Map<string, string>();

  beforeEach(() => {
    vi.resetModules();
    envMap.clear();
    vi.stubGlobal('Deno', {
      env: {
        get: (key: string) => envMap.get(key) ?? '',
      },
    });
  });

  async function loadRequireServiceRole() {
    return import('../requireServiceRole.ts');
  }

  it('rejects requests without an authorization header', async () => {
    const { requireServiceRole } = await loadRequireServiceRole();
    const corsHeaders = { 'Content-Type': 'application/json' };

    const result = requireServiceRole(new Request('https://example.com'), corsHeaders);

    expect(result.authorized).toBe(false);
    expect(result.response?.status).toBe(401);
    await expect(result.response?.json()).resolves.toEqual({
      success: false,
      error: 'Authorization required',
    });
  });

  it('rejects requests with the wrong bearer token', async () => {
    envMap.set('SUPABASE_SERVICE_ROLE_KEY', 'expected-service-role');
    const { requireServiceRole } = await loadRequireServiceRole();
    const corsHeaders = { 'Content-Type': 'application/json' };
    const request = new Request('https://example.com', {
      headers: { Authorization: 'Bearer wrong-token' },
    });

    const result = requireServiceRole(request, corsHeaders);

    expect(result.authorized).toBe(false);
    expect(result.response?.status).toBe(403);
    await expect(result.response?.json()).resolves.toEqual({
      success: false,
      error: 'Admin access required — use service role key',
    });
  });

  it('authorizes requests with the service-role bearer token', async () => {
    envMap.set('SUPABASE_SERVICE_ROLE_KEY', 'expected-service-role');
    const { requireServiceRole } = await loadRequireServiceRole();
    const corsHeaders = { 'Content-Type': 'application/json' };
    const request = new Request('https://example.com', {
      headers: { Authorization: 'Bearer expected-service-role' },
    });

    const result = requireServiceRole(request, corsHeaders);

    expect(result.authorized).toBe(true);
    expect(result.response).toBeNull();
  });
});
