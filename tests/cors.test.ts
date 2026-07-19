import { describe, it, expect } from 'vitest';
import { OPTIONS } from '@/app/api/submissions/route';

describe('CORS preflight — OPTIONS /api/submissions', () => {
  it('returns 204 with correct Allow-Origin / Methods / Headers', async () => {
    const req = new Request('http://localhost/api/submissions', {
      method: 'OPTIONS',
      headers: { Origin: 'https://customer.example' },
    });

    const res = await OPTIONS(req);

    expect(res.status).toBe(204);
    // Echoes the request Origin (not a hardcoded static value).
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://customer.example',
    );

    const methods = res.headers.get('access-control-allow-methods') ?? '';
    expect(methods).toContain('POST');
    expect(methods).toContain('OPTIONS');

    expect(res.headers.get('access-control-allow-headers')).toBe('Content-Type');
    expect(res.headers.get('access-control-max-age')).toBeTruthy();
  });

  it('falls back to * when the request carries no Origin', async () => {
    const req = new Request('http://localhost/api/submissions', {
      method: 'OPTIONS',
    });
    const res = await OPTIONS(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
