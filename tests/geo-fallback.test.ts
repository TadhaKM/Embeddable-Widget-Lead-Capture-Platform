import { describe, it, expect, afterEach } from 'vitest';
import { enrichGeo } from '@/lib/geo/providers';

describe('geo enrichment fallback chain', () => {
  afterEach(() => {
    delete process.env.GEO_PROVIDER_1_DOWN;
    delete process.env.GEO_PROVIDER_2_DOWN;
    delete process.env.GEO_PROVIDER_3_DOWN;
  });

  it('uses provider1 when all providers are healthy', async () => {
    const r = await enrichGeo('1.2.3.4');
    expect(r.provider).toBe('provider1');
    expect(r.geo).not.toBeNull();
  });

  it('falls back to provider2 when GEO_PROVIDER_1_DOWN=true, still enriched', async () => {
    process.env.GEO_PROVIDER_1_DOWN = 'true';
    const r = await enrichGeo('1.2.3.4');
    expect(r.provider).toBe('provider2');
    expect(r.geo).not.toBeNull();
    expect(r.geo?.country).toBeTruthy();
  });

  it('falls back to provider3 when providers 1 and 2 are down', async () => {
    process.env.GEO_PROVIDER_1_DOWN = 'true';
    process.env.GEO_PROVIDER_2_DOWN = 'true';
    const r = await enrichGeo('1.2.3.4');
    expect(r.provider).toBe('provider3');
    expect(r.geo).not.toBeNull();
  });

  it('degrades gracefully to null/none on total outage', async () => {
    process.env.GEO_PROVIDER_1_DOWN = 'true';
    process.env.GEO_PROVIDER_2_DOWN = 'true';
    process.env.GEO_PROVIDER_3_DOWN = 'true';
    const r = await enrichGeo('1.2.3.4');
    expect(r.provider).toBe('none');
    expect(r.geo).toBeNull();
  });
});
