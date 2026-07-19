/** Widget script version served at /widget.js (see app/widget.js/route.ts). */
export const WIDGET_SCRIPT_VERSION = 'v1';

export function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, '') ||
    'http://localhost:3000'
  );
}

/** The one-line embed snippet a customer drops on their site. */
export function embedSnippet(widgetId: string): string {
  return `<script src="${baseUrl()}/widget.js" data-widget-id="${widgetId}" async></script>`;
}

/** Attach the computed embed snippet to a widget object for API responses. */
export function withEmbedSnippet<T extends { id: string }>(
  widget: T,
): T & { embed_snippet: string } {
  return { ...widget, embed_snippet: embedSnippet(widget.id) };
}
