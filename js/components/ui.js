// Small presentational building blocks shared by every view.

import { PRIORITIES, PROJECT_STATUSES, TASK_STATUSES } from '../data/constants.js';
import { h, initials } from '../utils.js';

/** Lucide icon placeholder. Replaced by an SVG when refreshIcons() runs. */
export function icon(name, extraClass = '') {
  return h('i', { 'data-lucide': name, 'aria-hidden': 'true', class: `icon ${extraClass}`.trim() });
}

export function refreshIcons() {
  try {
    window.lucide?.createIcons();
  } catch (error) {
    console.warn('Nexora: icons could not be drawn', error);
  }
}

export function button({ label, icon: iconName, variant = 'secondary', type = 'button', onclick, dataset, disabled, attrs = {} }) {
  return h(
    'button',
    { type, class: `btn btn-${variant}`, onclick, dataset, disabled, ...attrs },
    iconName ? icon(iconName) : null,
    h('span', {}, label),
  );
}

export function iconButton({ icon: iconName, label, onclick, variant = 'ghost', dataset, attrs = {} }) {
  return h('button', { type: 'button', class: `icon-btn icon-btn-${variant}`, 'aria-label': label, title: label, onclick, dataset, ...attrs }, icon(iconName));
}

export function badge(text, { tone = 'neutral', iconName, className = '' } = {}) {
  return h('span', { class: `badge badge-${tone} ${className}`.trim() }, iconName ? icon(iconName) : null, h('span', {}, text));
}

export function statusBadge(statusId) {
  const status = TASK_STATUSES.find((s) => s.id === statusId);
  return badge(status?.label ?? statusId, { tone: `status-${statusId}`, iconName: status?.icon });
}

export function priorityBadge(priorityId) {
  const priority = PRIORITIES.find((p) => p.id === priorityId);
  return badge(priority?.label ?? priorityId, { tone: `priority-${priorityId}`, iconName: priority?.icon });
}

export function projectStatusBadge(statusId) {
  const status = PROJECT_STATUSES.find((s) => s.id === statusId);
  return badge(status?.label ?? statusId, { tone: `pstatus-${statusId}`, iconName: status?.icon });
}

export function dueBadge(info) {
  return badge(info.text, { tone: `due-${info.tone}`, iconName: info.overdue ? 'triangle-alert' : 'calendar' });
}

export function avatar(member, { size = 'md', labelled = false } = {}) {
  const name = member?.name ?? 'Unassigned';
  return h(
    'span',
    {
      class: `avatar avatar-${size}`,
      style: { background: member?.color ?? 'var(--color-muted-bg)' },
      role: labelled ? 'img' : null,
      'aria-label': labelled ? name : null,
      'aria-hidden': labelled ? null : 'true',
    },
    member ? initials(member.name) : '–',
  );
}

export function projectDot(color) {
  return h('span', { class: 'project-dot', style: { background: color }, 'aria-hidden': 'true' });
}

export function tagList(tags) {
  if (!tags?.length) return null;
  return h('ul', { class: 'tag-list', 'aria-label': 'Tags' }, tags.map((tag) => h('li', { class: 'tag' }, tag)));
}

export function progressBar(percent, { color, label } = {}) {
  return h(
    'div',
    {
      class: 'progress',
      role: 'progressbar',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': String(percent),
      'aria-label': label ?? 'Progress',
    },
    h('div', { class: 'progress-fill', style: { width: `${percent}%`, background: color ?? 'var(--color-accent)' } }),
  );
}

export function emptyState({ iconName = 'inbox', title, text, actions = [] }) {
  return h(
    'div',
    { class: 'empty-state' },
    h('span', { class: 'empty-icon' }, icon(iconName)),
    h('h3', {}, title),
    text ? h('p', {}, text) : null,
    actions.length ? h('div', { class: 'empty-actions' }, actions) : null,
  );
}

export function notice(text, { tone = 'info', iconName = 'info' } = {}) {
  return h('p', { class: `notice notice-${tone}`, role: tone === 'danger' ? 'alert' : null }, icon(iconName), h('span', {}, text));
}

export function section(title, { actions = null, className = '', description = null } = {}, ...content) {
  return h(
    'section',
    { class: `card ${className}`.trim() },
    h(
      'header',
      { class: 'card-header' },
      h('div', {}, h('h2', { class: 'card-title' }, title), description ? h('p', { class: 'card-description' }, description) : null),
      actions,
    ),
    ...content,
  );
}
