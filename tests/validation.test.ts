import { describe, it, expect, vi } from 'vitest';

// Mock the whole data-access seam — the boundary checks (413/400) run before
// most DB work, and the schema-invalid case only needs the widget lookup.
vi.mock('@/lib/db', () => ({
  getWidgetForSubmission: vi.fn(async () => ({
    id: 'w1',
    org_id: 'o1',
    type: 'signup',
    fields_json: [
      { name: 'email', label: 'Email', type: 'email', required: true },
    ],
    allowed_origins: null,
    webhook_url: null,
    status: 'active',
  })),
  insertHit: vi.fn(async () => {}),
  countRecentHits: vi.fn(async () => 0),
  insertSubmission: vi.fn(async () => 'sub-1'),
  logSideEffectFailure: vi.fn(async () => {}),
}));

import { POST } from '@/app/api/submissions/route';

function post(body: string): Request {
  return new Request('http://localhost/api/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

describe('submission validation boundary', () => {
  it('rejects malformed JSON with 400', async () => {
    const res = await POST(post('not json at all'));
    expect(res.status).toBe(400);
  });

  it('rejects a payload that fails the per-widget field schema with 400', async () => {
    const res = await POST(
      post(JSON.stringify({ widget_id: 'w1', fields: { email: 'not-an-email' } })),
    );
    expect(res.status).toBe(400);
  });

  it('rejects an oversized payload with 413', async () => {
    const big = 'x'.repeat(20 * 1024); // 20 KB > 16 KB cap
    const res = await POST(
      post(JSON.stringify({ widget_id: 'w1', fields: { email: 'a@b.com' }, junk: big })),
    );
    expect(res.status).toBe(413);
  });

  it('accepts a valid payload with 201 (sanity — proves 400s are real)', async () => {
    const res = await POST(
      post(JSON.stringify({ widget_id: 'w1', fields: { email: 'a@b.com' } })),
    );
    expect(res.status).toBe(201);
  });
});
