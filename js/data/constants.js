// Shared constants: enums, labels, navigation, palette.

export const APP_NAME = 'Nexora';
export const TAGLINE = 'Plan smarter. Deliver better.';
export const STORAGE_KEY = 'nexora.data';
export const CORRUPT_BACKUP_KEY = 'nexora.data.corrupt-backup';
export const SCHEMA_VERSION = 1;
export const MAX_ACTIVITY = 200;
export const MAX_READ_NOTIFICATIONS = 300;
export const CURRENT_USER_ID = 'member_001';

export const TASK_STATUSES = [
  { id: 'todo', label: 'To Do', icon: 'circle' },
  { id: 'in-progress', label: 'In Progress', icon: 'loader' },
  { id: 'in-review', label: 'In Review', icon: 'eye' },
  { id: 'done', label: 'Done', icon: 'circle-check' },
];

export const PRIORITIES = [
  { id: 'low', label: 'Low', rank: 1, icon: 'arrow-down' },
  { id: 'medium', label: 'Medium', rank: 2, icon: 'minus' },
  { id: 'high', label: 'High', rank: 3, icon: 'arrow-up' },
  { id: 'urgent', label: 'Urgent', rank: 4, icon: 'triangle-alert' },
];

export const PROJECT_STATUSES = [
  { id: 'planning', label: 'Planning', icon: 'compass' },
  { id: 'active', label: 'Active', icon: 'play' },
  { id: 'completed', label: 'Completed', icon: 'circle-check' },
  { id: 'archived', label: 'Archived', icon: 'archive' },
];

export const MEMBER_STATUSES = [
  { id: 'available', label: 'Available' },
  { id: 'busy', label: 'Busy' },
  { id: 'away', label: 'Away' },
];

export const PROJECT_COLORS = [
  '#6257E8', '#0F766E', '#B45309', '#BE185D', '#1D4ED8', '#15803D', '#7C3AED', '#C2410C',
];

export const CHART_COLORS = {
  status: { todo: '#94A3B8', 'in-progress': '#6257E8', 'in-review': '#F59E0B', done: '#10B981' },
  priority: { low: '#94A3B8', medium: '#38BDF8', high: '#F59E0B', urgent: '#EF4444' },
  open: '#6257E8',
  overdue: '#EF4444',
  done: '#10B981',
};

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Overview', title: 'Overview', icon: 'layout-dashboard' },
  { id: 'projects', label: 'Projects', title: 'Projects', icon: 'folder-kanban' },
  { id: 'tasks', label: 'My Tasks', title: 'My Tasks', icon: 'square-check-big' },
  { id: 'kanban', label: 'Kanban Board', title: 'Kanban Board', icon: 'kanban' },
  { id: 'team', label: 'Team', title: 'Team', icon: 'users' },
  { id: 'analytics', label: 'Analytics', title: 'Analytics', icon: 'chart-column' },
  { id: 'settings', label: 'Settings', title: 'Settings', icon: 'settings' },
];

export const DEFAULT_PREFERENCES = {
  theme: 'light',
  displayName: 'Alex Morgan',
  defaultTaskView: 'all', // 'all' | 'mine'
};

export const statusLabel = (id) => TASK_STATUSES.find((s) => s.id === id)?.label ?? id;
export const priorityLabel = (id) => PRIORITIES.find((p) => p.id === id)?.label ?? id;
export const projectStatusLabel = (id) => PROJECT_STATUSES.find((s) => s.id === id)?.label ?? id;
export const priorityRank = (id) => PRIORITIES.find((p) => p.id === id)?.rank ?? 0;
export const statusOrder = (id) => TASK_STATUSES.findIndex((s) => s.id === id);
