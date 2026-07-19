import { baseUrl, WIDGET_SCRIPT_VERSION } from '@/lib/embed';
import { HONEYPOT_FIELD } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// GET /widget.js — the vanilla, framework-free loader an embedding site pulls in.
// It reads data-widget-id off its own <script>, fetches the public config,
// renders a form (+ hidden honeypot), and POSTs submissions. BASE is injected
// server-side so the snippet is truly one line on the customer's page.
export async function GET(): Promise<Response> {
  return new Response(buildScript(baseUrl()), {
    status: 200,
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}

function buildScript(base: string): string {
  // NOTE: client code below uses string concatenation only — no `${}` — so the
  // template literal interpolates ONLY base / honeypot / version.
  return `/* Embeddable Widget loader ${WIDGET_SCRIPT_VERSION} */
(function () {
  var BASE = "${base}";
  var HONEYPOT = "${HONEYPOT_FIELD}";

  var self = document.currentScript;
  if (!self) {
    var tagged = document.querySelectorAll('script[data-widget-id]');
    self = tagged[tagged.length - 1];
  }
  if (!self) return;
  var widgetId = self.getAttribute('data-widget-id');
  if (!widgetId) return;

  var mount = document.createElement('div');
  mount.setAttribute('data-ewp-widget', widgetId);
  mount.style.cssText = 'font-family:system-ui,sans-serif;max-width:360px;';
  self.parentNode.insertBefore(mount, self.nextSibling);

  fetch(BASE + '/api/widgets/' + encodeURIComponent(widgetId) + '/config')
    .then(function (r) { if (!r.ok) throw new Error('config ' + r.status); return r.json(); })
    .then(function (cfg) { render(cfg); })
    .catch(function () { /* fail silent: never break the host page */ });

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) { for (var k in attrs) e.setAttribute(k, attrs[k]); }
    if (text != null) e.textContent = text;
    return e;
  }

  function htmlType(t) {
    if (t === 'email') return 'email';
    if (t === 'tel') return 'tel';
    if (t === 'number') return 'number';
    if (t === 'url') return 'url';
    return 'text';
  }

  function render(cfg) {
    var copy = cfg.copy || {};
    var fields = cfg.fields || [];

    var form = el('form');
    form.style.cssText = 'display:flex;flex-direction:column;gap:8px;border:1px solid #ddd;border-radius:8px;padding:16px;';

    if (copy.title) form.appendChild(el('h3', null, copy.title));
    if (copy.subtitle) form.appendChild(el('p', null, copy.subtitle));

    fields.forEach(function (f) {
      var label = el('label', null, f.label || f.name);
      label.style.cssText = 'display:flex;flex-direction:column;gap:4px;font-size:14px;';
      var input;
      if (f.type === 'textarea') {
        input = el('textarea', { name: f.name, rows: '3' });
      } else {
        input = el('input', { name: f.name, type: htmlType(f.type) });
      }
      if (f.required) input.setAttribute('required', 'required');
      input.style.cssText = 'padding:8px;border:1px solid #ccc;border-radius:4px;';
      label.appendChild(input);
      form.appendChild(label);
    });

    // Honeypot: visually hidden but NOT display:none (bots skip display:none).
    var hp = el('input', { type: 'text', name: HONEYPOT, tabindex: '-1', autocomplete: 'off' });
    hp.setAttribute('aria-hidden', 'true');
    hp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;';
    form.appendChild(hp);

    var submit = el('button', { type: 'submit' }, copy.submit || 'Submit');
    submit.style.cssText = 'padding:10px;border:0;border-radius:4px;background:#111;color:#fff;cursor:pointer;';
    form.appendChild(submit);

    var status = el('div');
    status.setAttribute('role', 'status');
    status.style.cssText = 'font-size:14px;min-height:18px;';
    form.appendChild(status);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      submit.disabled = true;
      status.textContent = '';

      var payload = { widget_id: widgetId, fields: {}, honeypot: hp.value };
      fields.forEach(function (f) {
        var node = form.elements[f.name];
        if (node) payload.fields[f.name] = node.value;
      });

      fetch(BASE + '/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, status: r.status, body: b }; }); })
        .then(function (res) {
          if (res.ok) {
            form.reset();
            status.style.color = '#0a7d17';
            status.textContent = copy.success || 'Thanks!';
          } else {
            status.style.color = '#c00';
            status.textContent = (res.body && res.body.error) || ('Error ' + res.status);
          }
        })
        .catch(function () {
          status.style.color = '#c00';
          status.textContent = 'Network error';
        })
        .then(function () { submit.disabled = false; });
    });

    mount.appendChild(form);
  }
})();
`;
}
