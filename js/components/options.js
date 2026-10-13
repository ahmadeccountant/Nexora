// <option> list builders shared by forms and filter bars.

import { CURRENT_USER_ID, PRIORITIES, PROJECT_STATUSES, TASK_STATUSES } from '../data/constants.js';

export function memberOptions(team, { all = null, unassigned = null } = {}) {
  return [
    ...(all ? [{ value: 'all', label: all }] : []),
    ...(unassigned ? [{ value: unassigned.value, label: unassigned.label }] : []),
    ...team.map((m) => ({ value: m.id, label: m.id === CURRENT_USER_ID ? `${m.name} (you)` : m.name })),
  ];
}

export function projectOptions(projects, { all = null, includeArchived = true } = {}) {
  const list = includeArchived ? projects : projects.filter((p) => p.status !== 'archived');
  return [
    ...(all ? [{ value: 'all', label: all }] : []),
    ...list.map((p) => ({ value: p.id, label: p.status === 'archived' ? `${p.name} (archived)` : p.name })),
  ];
}

export function statusOptions({ all = null, extra = [] } = {}) {
  return [
    ...(all ? [{ value: 'all', label: all }] : []),
    ...extra,
    ...TASK_STATUSES.map((s) => ({ value: s.id, label: s.label })),
  ];
}

export function priorityOptions({ all = null } = {}) {
  return [...(all ? [{ value: 'all', label: all }] : []), ...PRIORITIES.map((p) => ({ value: p.id, label: p.label }))];
}

export function projectStatusOptions({ all = null, includeArchived = true } = {}) {
  const list = includeArchived ? PROJECT_STATUSES : PROJECT_STATUSES.filter((s) => s.id !== 'archived');
  return [...(all ? [{ value: 'all', label: all }] : []), ...list.map((s) => ({ value: s.id, label: s.label }))];
}

/** Replace a <select>'s options only when they changed, keeping the current value when still valid. */
export function syncSelect(select, options, fallback = 'all') {
  const signature = JSON.stringify(options);
  if (select.dataset.signature === signature) return false;
  const previous = select.value;
  select.replaceChildren(...options.map((o) => Object.assign(document.createElement('option'), { value: o.value, textContent: o.label })));
  select.dataset.signature = signature;
  select.value = options.some((o) => o.value === previous) ? previous : fallback;
  return select.value !== previous;
}
