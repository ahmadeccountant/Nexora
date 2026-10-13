// Safe, versioned LocalStorage access plus full-dataset validation.
// Everything that reads persisted or imported data goes through validateAppData().

import {
  CORRUPT_BACKUP_KEY,
  DEFAULT_PREFERENCES,
  MAX_ACTIVITY,
  MAX_READ_NOTIFICATIONS,
  MEMBER_STATUSES,
  PRIORITIES,
  PROJECT_STATUSES,
  SCHEMA_VERSION,
  STORAGE_KEY,
  TASK_STATUSES,
} from './data/constants.js';
import { isValidDateStr, nowIso, safeJsonParse } from './utils.js';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const isIso = (v) => typeof v === 'string' && !Number.isNaN(new Date(v).getTime());
const inList = (list, id) => list.some((item) => item.id === id);

function getStore() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isStorageAvailable() {
  const store = getStore();
  if (!store) return false;
  try {
    const key = `${STORAGE_KEY}.probe`;
    store.setItem(key, '1');
    store.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function saveData(data) {
  const store = getStore();
  if (!store) return { ok: false, error: 'LocalStorage is not available.' };
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(data));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not write to LocalStorage.' };
  }
}

/**
 * Load saved data.
 * status: 'ok' | 'empty' | 'corrupt' | 'unavailable'
 */
export function loadData() {
  if (!isStorageAvailable()) return { status: 'unavailable', data: null, errors: [] };
  const store = getStore();
  const raw = store.getItem(STORAGE_KEY);
  if (raw === null) return { status: 'empty', data: null, errors: [] };

  const parsed = safeJsonParse(raw);
  const result = parsed.ok ? validateAppData(parsed.value) : { ok: false, errors: [`Saved data is not valid JSON (${parsed.error}).`] };
  if (result.ok) return { status: 'ok', data: result.data, errors: [] };

  // Keep the unreadable copy so nothing is silently destroyed.
  try {
    store.setItem(CORRUPT_BACKUP_KEY, raw);
  } catch {
    /* ignore: backup is best effort */
  }
  return { status: 'corrupt', data: null, errors: result.errors };
}

export function clearSavedData() {
  const store = getStore();
  try {
    store?.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Approximate bytes used by the saved dataset. */
export function savedDataSize() {
  try {
    const raw = getStore()?.getItem(STORAGE_KEY);
    return raw ? new Blob([raw]).size : 0;
  } catch {
    return 0;
  }
}

/** Upgrade older shapes to the current schema, one version at a time. */
const MIGRATIONS = {
  // Unversioned data (v0) predates completedAt, previousStatus and notification state.
  0: (raw) => ({ ...raw, version: 1 }),
};

function migrate(raw) {
  let current = raw;
  let version = Number.isInteger(raw.version) ? raw.version : 0;
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) break;
    current = step(current);
    version += 1;
  }
  return current;
}

/**
 * Validate and normalize a full dataset (saved data or an imported backup).
 * Returns { ok, errors, data }. `data` is only meaningful when ok is true.
 */
export function validateAppData(input) {
  const errors = [];
  const fail = (message) => {
    if (errors.length < 10) errors.push(message);
    else if (errors.length === 10) errors.push('…and more problems were found.');
  };

  if (!isObject(input)) return { ok: false, errors: ['The data must be a JSON object.'], data: null };

  const raw = migrate(input);
  if (Number.isInteger(raw.version) && raw.version > SCHEMA_VERSION) {
    return { ok: false, errors: [`This data was created by a newer version of Nexora (schema ${raw.version}).`], data: null };
  }
  for (const key of ['team', 'projects', 'tasks']) {
    if (!Array.isArray(raw[key])) fail(`“${key}” must be a list.`);
  }
  if (errors.length) return { ok: false, errors, data: null };

  const now = nowIso();

  // Team
  const memberIds = new Set();
  const team = [];
  raw.team.forEach((m, i) => {
    const label = `Team member #${i + 1}`;
    if (!isObject(m) || !isText(m.id)) return fail(`${label} needs an id.`);
    if (memberIds.has(m.id)) return fail(`${label} reuses the id “${m.id}”.`);
    if (!isText(m.name)) return fail(`${label} needs a name.`);
    memberIds.add(m.id);
    team.push({
      id: m.id,
      name: m.name.trim(),
      role: typeof m.role === 'string' ? m.role : '',
      email: typeof m.email === 'string' ? m.email : '',
      color: HEX_COLOR.test(m.color) ? m.color : '#6257E8',
      status: inList(MEMBER_STATUSES, m.status) ? m.status : 'available',
    });
  });

  // Projects
  const projectIds = new Set();
  const projects = [];
  raw.projects.forEach((p, i) => {
    const label = `Project #${i + 1}`;
    if (!isObject(p) || !isText(p.id)) return fail(`${label} needs an id.`);
    if (projectIds.has(p.id)) return fail(`${label} reuses the id “${p.id}”.`);
    if (!isText(p.name)) return fail(`${label} needs a name.`);
    if (!memberIds.has(p.ownerId)) return fail(`${label} (“${p.name}”) has an unknown owner “${p.ownerId}”.`);
    if (!inList(PROJECT_STATUSES, p.status)) return fail(`${label} (“${p.name}”) has an invalid status.`);
    if (!isValidDateStr(p.startDate) || !isValidDateStr(p.dueDate)) return fail(`${label} (“${p.name}”) needs valid start and due dates.`);
    if (p.dueDate < p.startDate) return fail(`${label} (“${p.name}”) is due before it starts.`);
    projectIds.add(p.id);
    const previous = inList(PROJECT_STATUSES, p.previousStatus) && p.previousStatus !== 'archived' ? p.previousStatus : null;
    projects.push({
      id: p.id,
      name: p.name.trim(),
      description: typeof p.description === 'string' ? p.description : '',
      ownerId: p.ownerId,
      status: p.status,
      previousStatus: p.status === 'archived' ? previous ?? 'active' : null,
      startDate: p.startDate,
      dueDate: p.dueDate,
      color: HEX_COLOR.test(p.color) ? p.color : '#6257E8',
      createdAt: isIso(p.createdAt) ? p.createdAt : now,
      updatedAt: isIso(p.updatedAt) ? p.updatedAt : isIso(p.createdAt) ? p.createdAt : now,
    });
  });

  // Tasks
  const taskIds = new Set();
  const tasks = [];
  raw.tasks.forEach((t, i) => {
    const label = `Task #${i + 1}`;
    if (!isObject(t) || !isText(t.id)) return fail(`${label} needs an id.`);
    if (taskIds.has(t.id)) return fail(`${label} reuses the id “${t.id}”.`);
    if (!isText(t.title)) return fail(`${label} needs a title.`);
    if (!projectIds.has(t.projectId)) return fail(`${label} (“${t.title}”) points to an unknown project “${t.projectId}”.`);
    const assigneeId = t.assigneeId ?? '';
    if (assigneeId !== '' && !memberIds.has(assigneeId)) return fail(`${label} (“${t.title}”) points to an unknown assignee “${assigneeId}”.`);
    if (!inList(TASK_STATUSES, t.status)) return fail(`${label} (“${t.title}”) has an invalid status.`);
    if (!inList(PRIORITIES, t.priority)) return fail(`${label} (“${t.title}”) has an invalid priority.`);
    const dueDate = t.dueDate ?? '';
    if (dueDate !== '' && !isValidDateStr(dueDate)) return fail(`${label} (“${t.title}”) has an invalid due date.`);
    taskIds.add(t.id);
    const createdAt = isIso(t.createdAt) ? t.createdAt : now;
    const updatedAt = isIso(t.updatedAt) ? t.updatedAt : createdAt;
    tasks.push({
      id: t.id,
      projectId: t.projectId,
      title: t.title.trim(),
      description: typeof t.description === 'string' ? t.description : '',
      assigneeId,
      status: t.status,
      priority: t.priority,
      dueDate,
      tags: Array.isArray(t.tags) ? t.tags.filter((tag) => typeof tag === 'string' && tag.trim()).map((tag) => tag.trim()).slice(0, 8) : [],
      createdAt,
      updatedAt,
      completedAt: t.status === 'done' ? (isIso(t.completedAt) ? t.completedAt : updatedAt) : null,
    });
  });

  if (errors.length) return { ok: false, errors, data: null };

  // Activity: entries that are malformed are dropped rather than failing the whole import.
  const activity = (Array.isArray(raw.activity) ? raw.activity : [])
    .filter((a) => isObject(a) && isText(a.id) && isText(a.type) && isText(a.description) && isIso(a.timestamp))
    .map((a) => ({
      id: a.id,
      type: a.type,
      description: a.description,
      timestamp: a.timestamp,
      entityType: typeof a.entityType === 'string' ? a.entityType : null,
      entityId: typeof a.entityId === 'string' ? a.entityId : null,
    }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, MAX_ACTIVITY);

  const prefs = isObject(raw.preferences) ? raw.preferences : {};
  const displayName = typeof prefs.displayName === 'string' ? prefs.displayName.trim() : '';
  const preferences = {
    theme: prefs.theme === 'dark' ? 'dark' : 'light',
    displayName: displayName && displayName.length <= 40 ? displayName : DEFAULT_PREFERENCES.displayName,
    defaultTaskView: prefs.defaultTaskView === 'mine' ? 'mine' : 'all',
  };

  const notificationsRead = (Array.isArray(raw.notificationsRead) ? raw.notificationsRead : [])
    .filter((id) => typeof id === 'string')
    .slice(-MAX_READ_NOTIFICATIONS);

  return {
    ok: true,
    errors: [],
    data: { version: SCHEMA_VERSION, team, projects, tasks, activity, preferences, notificationsRead },
  };
}

/** Parse the text of a backup file. Accepts the export envelope or a bare dataset. */
export function parseBackup(text) {
  const parsed = safeJsonParse(text);
  if (!parsed.ok) return { ok: false, errors: [`That file isn’t valid JSON (${parsed.error}).`], data: null };
  const payload = isObject(parsed.value) && parsed.value.app === 'nexora' && isObject(parsed.value.data) ? parsed.value.data : parsed.value;
  return validateAppData(payload);
}
