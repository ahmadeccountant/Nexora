// Thin wrapper around Chart.js (loaded from a pinned CDN build as window.Chart).
// - one registry entry per chart key, so charts are updated or destroyed, never duplicated
// - empty datasets show a message instead of a blank canvas
// - if Chart.js failed to load, a plain-text summary is shown instead

import { h } from '../utils.js';

const registry = new Map();

export const chartsAvailable = () => typeof window.Chart === 'function';

function css(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function themeColors() {
  return {
    text: css('--color-text', '#1b1a2e'),
    muted: css('--color-text-muted', '#5f5c7a'),
    grid: css('--color-border', '#e4e2f0'),
    surface: css('--color-surface', '#ffffff'),
  };
}

/** Build the card that hosts one chart. Call renderChart() to fill it. */
export function createChartCard({ title, description = '', height = 250, className = '' }) {
  const canvas = h('canvas', { role: 'img', 'aria-label': title });
  const empty = h('p', { class: 'chart-message', hidden: true });
  const wrap = h('div', { class: 'chart-wrap', style: { height: `${height}px` } }, canvas, empty);
  const el = h(
    'section',
    { class: `card chart-card ${className}`.trim() },
    h('header', { class: 'card-header' }, h('div', {}, h('h2', { class: 'card-title' }, title), description ? h('p', { class: 'card-description' }, description) : null)),
    wrap,
  );
  return { el, canvas, message: empty, title };
}

export function destroyChart(key) {
  const chart = registry.get(key);
  if (chart) {
    chart.destroy();
    registry.delete(key);
  }
}

export function destroyAllCharts() {
  [...registry.keys()].forEach(destroyChart);
}

/**
 * @param {string} key Unique key for this chart (e.g. "dashboard:status").
 * @param {ReturnType<typeof createChartCard>} card
 * @param {{ type:string, data:object, options?:object, isEmpty:boolean, emptyText?:string, summary:string }} config
 */
export function renderChart(key, card, { type, data, options = {}, isEmpty, emptyText = 'No data to show yet.', summary }) {
  card.canvas.setAttribute('aria-label', `${card.title}. ${summary}`);

  if (isEmpty) {
    destroyChart(key);
    card.canvas.hidden = true;
    card.message.hidden = false;
    card.message.textContent = emptyText;
    return;
  }
  if (!chartsAvailable()) {
    destroyChart(key);
    card.canvas.hidden = true;
    card.message.hidden = false;
    card.message.textContent = `Chart unavailable offline. ${summary}`;
    return;
  }

  card.canvas.hidden = false;
  card.message.hidden = true;

  const colors = themeColors();
  window.Chart.defaults.color = colors.muted;
  window.Chart.defaults.borderColor = colors.grid;
  window.Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const merged = {
    responsive: true,
    maintainAspectRatio: false,
    animation: reducedMotion ? false : { duration: 350 },
    ...options,
  };

  const existing = registry.get(key);
  if (existing && existing.config.type === type && existing.canvas === card.canvas) {
    existing.data = data;
    existing.options = merged;
    existing.update();
    return;
  }
  destroyChart(key);
  registry.set(key, new window.Chart(card.canvas, { type, data, options: merged }));
}

/** Shared option fragments so every chart looks consistent in both themes. */
export function axisOptions({ horizontal = false, stacked = false, max } = {}) {
  const colors = themeColors();
  const valueAxis = {
    beginAtZero: true,
    stacked,
    max,
    ticks: { precision: 0, color: colors.muted },
    grid: { color: colors.grid },
  };
  const categoryAxis = { stacked, ticks: { color: colors.muted }, grid: { display: false } };
  return horizontal ? { indexAxis: 'y', scales: { x: valueAxis, y: categoryAxis } } : { scales: { x: categoryAxis, y: valueAxis } };
}

export function legendOptions(position = 'bottom') {
  return { legend: { position, labels: { usePointStyle: true, boxWidth: 8, color: themeColors().muted } } };
}
