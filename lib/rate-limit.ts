import { countRecentHits, insertHit } from '@/lib/db';
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_SEC } from '@/lib/constants';

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  retryAfterSec: number;
}

/**
 * Sliding-window limiter over rate_limit_hits. A hit is recorded on EVERY
 * attempt (including ones that end up rejected), then the trailing-window count
 * — which includes the just-inserted hit — is compared to the threshold.
 * Sustained abuse keeps the window saturated and the caller blocked.
 */
export async function checkRateLimit(
  widgetId: string,
  ipHash: string,
): Promise<RateLimitResult> {
  const sinceIso = new Date(
    Date.now() - RATE_LIMIT_WINDOW_SEC * 1000,
  ).toISOString();

  await insertHit(widgetId, ipHash);
  const count = await countRecentHits(widgetId, ipHash, sinceIso);

  return {
    allowed: count <= RATE_LIMIT_MAX,
    count,
    retryAfterSec: RATE_LIMIT_WINDOW_SEC,
  };
}
