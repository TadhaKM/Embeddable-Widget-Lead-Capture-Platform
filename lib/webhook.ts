import { WEBHOOK_TIMEOUT_MS } from '@/lib/constants';
import { logSideEffectFailure } from '@/lib/db';

/**
 * Safe side effect: POST the submission to the widget's webhook_url AFTER the DB
 * write. Bounded by a 3s timeout and fully wrapped so it can NEVER throw, fail
 * the submission response, or delay it past the timeout. Failures are logged to
 * side_effect_failures and swallowed.
 */
export async function fireWebhook(opts: {
  url: string;
  submissionId: string;
  payload: unknown;
}): Promise<void> {
  const { url, submissionId, payload } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      await safeLog(submissionId, `webhook responded ${res.status}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await safeLog(submissionId, message);
  } finally {
    clearTimeout(timer);
  }
}

/** Even the failure log must not throw back into the request path. */
async function safeLog(submissionId: string, message: string): Promise<void> {
  try {
    await logSideEffectFailure(submissionId, 'webhook', message);
  } catch {
    // last-resort: nothing we can do; never propagate
  }
}
