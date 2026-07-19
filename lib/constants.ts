/** Shared tunables for the public submission path. */

/** Top-level payload key carrying the honeypot value. Non-empty => spam. */
export const HONEYPOT_FIELD = 'honeypot';

/** Hard cap on submission request bodies (bytes). Over this => 413. */
export const MAX_BODY_BYTES = 16 * 1024; // 16 KB

/** Sliding-window rate limit per (widget_id, ip_hash). */
export const RATE_LIMIT_MAX = 10;
export const RATE_LIMIT_WINDOW_SEC = 60;

/** Webhook side-effect timeout. Must never delay the response past this. */
export const WEBHOOK_TIMEOUT_MS = 3000;
