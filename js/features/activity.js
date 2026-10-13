// Activity feed rendering. Entries are created by state mutations only
// (see state.js), never by rendering.

import { emptyState, icon, refreshIcons } from '../components/ui.js';
import { openModal } from '../components/modal.js';
import { getState } from '../state.js';
import { navigate } from '../router.js';
import { h, relativeTime } from '../utils.js';

const TYPE_META = {
  project_created: { icon: 'folder-plus', tone: 'success' },
  project_updated: { icon: 'pencil', tone: 'accent' },
  project_archived: { icon: 'archive', tone: 'accent' },
  project_restored: { icon: 'archive-restore', tone: 'success' },
  project_deleted: { icon: 'trash-2', tone: 'danger' },
  task_created: { icon: 'plus', tone: 'success' },
  task_updated: { icon: 'pencil', tone: 'accent' },
  task_completed: { icon: 'circle-check', tone: 'success' },
  task_moved: { icon: 'arrow-right', tone: 'accent' },
  task_reassigned: { icon: 'user', tone: 'accent' },
  task_deleted: { icon: 'trash-2', tone: 'danger' },
  data_reset: { icon: 'rotate-ccw', tone: 'accent' },
  data_restored: { icon: 'upload', tone: 'accent' },
};

function entityRoute(entry, state) {
  if (entry.entityType === 'task' && state.tasks.some((t) => t.id === entry.entityId)) return `tasks/${entry.entityId}`;
  if (entry.entityType === 'project' && state.projects.some((p) => p.id === entry.entityId)) return `projects/${entry.entityId}`;
  return null;
}

export function renderActivityList(entries, { limit = 8, onNavigate = null } = {}) {
  const state = getState();
  const items = entries.slice(0, limit);
  if (!items.length) {
    return emptyState({ iconName: 'history', title: 'No activity yet', text: 'Changes to projects and tasks will show up here as you make them.' });
  }
  const now = new Date();
  return h(
    'ul',
    { class: 'list' },
    items.map((entry) => {
      const meta = TYPE_META[entry.type] ?? { icon: 'activity', tone: 'accent' };
      const route = entityRoute(entry, state);
      const text = route
        ? h('button', { type: 'button', class: 'link-btn activity-text', onclick: () => { onNavigate?.(); navigate(route); } }, entry.description)
        : h('span', { class: 'activity-text' }, entry.description);
      return h(
        'li',
        {},
        h('span', { class: `activity-icon${meta.tone === 'danger' ? ' activity-icon-danger' : meta.tone === 'success' ? ' activity-icon-success' : ''}` }, icon(meta.icon)),
        h('div', { class: 'list-main' }, text, h('time', { class: 'list-meta', datetime: entry.timestamp, title: new Date(entry.timestamp).toLocaleString() }, relativeTime(entry.timestamp, now))),
      );
    }),
  );
}

export function openActivityModal() {
  let modal;
  const list = renderActivityList(getState().activity, { limit: 50, onNavigate: () => modal.close() });
  modal = openModal({ title: 'Recent activity', size: 'md', body: list });
  refreshIcons();
}
