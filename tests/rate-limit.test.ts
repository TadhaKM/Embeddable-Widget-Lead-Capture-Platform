import { describe, it, expect, vi } from 'vitest';

// Mock the DB seam. Keep the hit counter INSIDE the factory (vi.mock is hoisted,
// so it must not reference outer variables). insertHit increments; countRecentHits
// returns the running count (incl. the just-inserted hit), mirroring the real
// sliding window.
vi.mock('@/lib/db', () => {
  let hits = 0;
  return {
    getWidgetForSubmission: vi.fn(async () => ({
      id: 'w1',
      org_id: 'o1',
      type: 'signup',
      fields_json: [], // no required fields — an empty {} passes validation
      allowed_origins: null,
      webhook_url: null,
      status: 'active',
    })),
    insertHit: vi.fn(async () => {
      hits += 1;
    }),
    countRecentHits: vi.fn(async () => hits),
    insertSubmission: vi.fn(async () => 'sub-1'),
    logSideEffectFailure: vi.fn(async () => {}),
  };
});

import { POST } from '@/app/api/submissions/route';
import { RATE_LIMIT_MAX } from '@/lib/constants';

function post(): Request {
  return new Request('http://localhost/api/submissions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '9.9.9.9',
    },
    body: JSON.stringify({ widget_id: 'w1', fields: {} }),
  });
}

describe('rate limiting', () => {
  it('returns 429 with Retry-After once a burst passes the threshold', async () => {
    const statuses: number[] = [];
    let retryAfter: string | null = null;

    for (let i = 0; i < RATE_LIMIT_MAX + 3; i++) {
      const res = await POST(post());
      statuses.push(res.status);
      if (res.status === 429 && retryAfter === null) {
        retryAfter = res.headers.get('retry-after');
      }
    }

    // The first RATE_LIMIT_MAX attempts are accepted (201)...
    expect(statuses.slice(0, RATE_LIMIT_MAX).every((s) => s === 201)).toBe(true);
    // ...and everything past the threshold is rejected with 429 + Retry-After.
    expect(statuses[RATE_LIMIT_MAX]).toBe(429);
    expect(statuses.at(-1)).toBe(429);
    expect(retryAfter).toBeTruthy();
  });
});
