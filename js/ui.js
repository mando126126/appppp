// Kleine DOM- und Formatier-Helfer. Bewusst winzig gehalten – kein Framework,
// damit die App ohne Build-Schritt direkt auf jedem Static-Host läuft.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(4)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/* ---------- Icons (inline, damit offline nichts fehlt) ---------- */

const PATHS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H3z"/><path d="M16.5 13.5h.01"/>',
  heart: '<path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 2.6c0 5.8-8.5 11.3-8.5 11.3z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.2a2 2 0 1 1-4 0V21a1.6 1.6 0 0 0-2.7-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15a2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.2-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 4.3a2 2 0 1 1 4 0 1.6 1.6 0 0 0 2.7 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.2 2.7 2 2 0 1 1 0 4z"/>',
  pencil: '<path d="M4 20h4L20 8a2.5 2.5 0 0 0-3.5-3.5L4 16.5z"/>',
  x: '<path d="M6 6 18 18M18 6 6 18"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h2.6l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.2L21 7H6"/>',
  sparkle: '<path d="M12 3.5 13.9 9l5.6 2-5.6 2-1.9 5.5L10.1 13 4.5 11l5.6-2z"/>',
};

export function icon(name, size) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (size) { svg.style.width = size + 'px'; svg.style.height = size + 'px'; }
  svg.innerHTML = PATHS[name] || '';
  return svg;
}

/* ---------- Datum & Zahlen ---------- */

export const todayISO = () => toISO(new Date());

export function toISO(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function daysBetween(isoA, isoB) {
  const ms = parseISO(isoB) - parseISO(isoA);
  return Math.round(ms / 86400000);
}

export function formatDate(iso, opts = { weekday: 'short', day: 'numeric', month: 'long' }) {
  return parseISO(iso).toLocaleDateString('de-DE', opts);
}

/** "Heute", "Morgen", "Gestern" – sonst normales Datum. */
export function friendlyDate(iso) {
  const diff = daysBetween(todayISO(), iso);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  if (diff === -1) return 'Gestern';
  const withYear = parseISO(iso).getFullYear() !== new Date().getFullYear();
  return formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', ...(withYear && { year: 'numeric' }) });
}

export function relativeTime(ts) {
  const s = Math.round((Date.now() - new Date(ts)) / 1000);
  if (s < 60) return 'gerade eben';
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`;
  if (s < 604800) return `vor ${Math.floor(s / 86400)} Tg.`;
  return formatDate(toISO(new Date(ts)), { day: 'numeric', month: 'short' });
}

export const money = (n) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0);

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const initials = (name) => (name || '?').trim().slice(0, 1).toUpperCase();

/* ---------- Bottom Sheet ---------- */

/**
 * Öffnet ein Bottom-Sheet. `build(close)` liefert den Inhalt.
 * Schließt per Backdrop-Tap, Escape oder close().
 */
export function sheet(title, build) {
  const host = $('#sheet-host');
  const backdrop = h('div', { class: 'sheet-backdrop' });
  const close = () => {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'grabber' }),
    h('h2', {}, title),
    build(close),
  );
  backdrop.append(panel);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKey);
  host.append(backdrop);

  const focusable = panel.querySelector('input, textarea, select, button');
  if (focusable && !('ontouchstart' in window)) focusable.focus();
  return close;
}

export function confirmSheet(title, message, onYes, yesLabel = 'Löschen') {
  sheet(title, (close) => h('div', {},
    h('p', { class: 'muted', style: 'margin-top:0' }, message),
    h('div', { class: 'sheet-actions' },
      h('button', { class: 'btn ghost', onClick: close }, 'Abbrechen'),
      h('button', {
        class: 'btn primary',
        onClick: () => { close(); onYes(); },
      }, yesLabel),
    ),
  ));
}

export function toast(msg) {
  const host = $('#toast-host');
  const el = h('div', { class: 'toast' }, msg);
  host.append(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 320);
  }, 2200);
}

export function emptyState(emoji, text) {
  return h('div', { class: 'empty' }, h('span', { class: 'big' }, emoji), text);
}
