import type { GeoResult } from '@/lib/types';

/**
 * Mock geo enrichment with a 3-provider fallback chain. Each provider resolves
 * a {country, region, city} or throws. The GEO_PROVIDER_*_DOWN env flags force a
 * provider to throw, for deterministic outage testing.
 */

export type GeoProvider = (ip: string) => Promise<GeoResult>;
export type GeoProviderName = 'provider1' | 'provider2' | 'provider3' | 'none';

function isDown(flag: string): boolean {
  const v = process.env[flag];
  return v === 'true' || v === '1';
}

export const provider1: GeoProvider = async (_ip) => {
  if (isDown('GEO_PROVIDER_1_DOWN')) throw new Error('geo provider1 unavailable');
  return { country: 'US', region: 'CA', city: 'San Francisco' };
};

export const provider2: GeoProvider = async (_ip) => {
  if (isDown('GEO_PROVIDER_2_DOWN')) throw new Error('geo provider2 unavailable');
  return { country: 'US', region: 'NY', city: 'New York' };
};

export const provider3: GeoProvider = async (_ip) => {
  // Last resort. GEO_PROVIDER_3_DOWN (optional) lets tests force a TOTAL outage
  // to exercise the graceful-degradation-to-null path.
  if (isDown('GEO_PROVIDER_3_DOWN')) throw new Error('geo provider3 unavailable');
  return { country: 'US', region: 'TX', city: 'Austin' };
};

const CHAIN: Array<[Exclude<GeoProviderName, 'none'>, GeoProvider]> = [
  ['provider1', provider1],
  ['provider2', provider2],
  ['provider3', provider3],
];

export interface GeoLookup {
  geo: GeoResult | null;
  provider: GeoProviderName;
}

/** Try provider1 -> provider2 -> provider3; on total failure return null/'none'. */
export async function enrichGeo(ip: string): Promise<GeoLookup> {
  for (const [name, fn] of CHAIN) {
    try {
      const geo = await fn(ip);
      return { geo, provider: name };
    } catch {
      // provider down — fall through to the next one
    }
  }
  return { geo: null, provider: 'none' };
}
