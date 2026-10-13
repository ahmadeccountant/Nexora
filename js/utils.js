// Small, dependency-free helpers: ids, dates, DOM building, parsing, downloads.

let idCounter = 0;
export function uid(prefix) {
  idCounter += 1;
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${rand}`;
}

export const nowIso = () => new Date().toISOString();

const pad2 = (n) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export function toDateStr(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export const todayStr = () => toDateStr(new Date());

/** Parse YYYY-MM-DD as local midnight. Returns null when invalid. */
export function parseDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

export const isValidDateStr = (str) => parseDate(str) !== null;

export function addDays(dateStr, n) {
  const d = parseDate(dateStr) ?? new Date();
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a, b) {
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da || !db) return 0;
  return Math.round((db - da) / 86400000);
}

export function formatDate(str) {
  const d = parseDate(str);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatShortDate(str) {
  const d = parseDate(str);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function relativeTime(iso, now = new Date()) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const seconds = Math.round((now - then) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = daysBetween(toDateStr(then), toDateStr(now));
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: then.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

/** Describe a due date relative to today. tone: danger | warning | neutral */
export function dueInfo(dueDate, isDone, today = todayStr()) {
  if (!dueDate) return { text: 'No due date', tone: 'neutral', overdue: false };
  if (isDone) return { text: formatShortDate(dueDate), tone: 'neutral', overdue: false };
  const diff = daysBetween(today, dueDate);
  if (diff < 0) return { text: `${-diff} ${-diff === 1 ? 'day' : 'days'} overdue`, tone: 'danger', overdue: true };
  if (diff === 0) return { text: 'Due today', tone: 'warning', overdue: false };
  if (diff === 1) return { text: 'Due tomorrow', tone: 'warning', overdue: false };
  if (diff <= 3) return { text: `Due in ${diff} days`, tone: 'warning', overdue: false };
  return { text: `Due ${formatShortDate(dueDate)}`, tone: 'neutral', overdue: false };
}

export const pluralize = (n, singular, plural = `${singular}s`) => `${n} ${n === 1 ? singular : plural}`;

export function initials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export const indexById = (list) => new Map(list.map((item) => [item.id, item]));

export function debounce(fn, wait = 150) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

export function normalizeTags(input) {
  const raw = Array.isArray(input) ? input : String(input ?? '').split(',');
  const seen = new Set();
  const tags = [];
  for (const tag of raw) {
    const clean = String(tag).trim().replace(/\s+/g, ' ');
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) {
      seen.add(key);
      tags.push(clean);
    }
  }
  return tags;
}

export function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Trigger a browser download. Throws when the browser blocks it. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export const dateStamp = () => toDateStr(new Date());

/**
 * Tiny DOM builder. Text is always inserted as text nodes (never HTML),
 * so user-entered content cannot inject markup.
 *   h('button', { class: 'btn', onclick: fn, dataset: { id } }, 'Save')
 */
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key === 'value' || key === 'checked' || key === 'selected' || key === 'disabled' || key === 'hidden') node[key] = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  append(node, children);
  return node;
}

export function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  node.replaceChildren();
  return node;
}
