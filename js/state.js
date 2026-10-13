// Centralized application state. Every change goes through a mutation here,
// which validates input, records activity (only on real changes), saves to
// LocalStorage, and then notifies subscribers once.

import { CURRENT_USER_ID, MAX_ACTIVITY, MAX_READ_NOTIFICATIONS, SCHEMA_VERSION, statusLabel } from './data/constants.js';
import { buildSeedData } from './data/seed.js';
import { saveData } from './storage.js';
import { indexById, nowIso, uid } from './utils.js';
import { validateDisplayName, validateProjectInput, validateTaskInput } from './validation.js';

let data = null;
let storage = { available: true, error: null };
const listeners = new Set();

export function initState(initial, { storageAvailable = true } = {}) {
  data = initial;
  storage = { available: storageAvailable, error: null };
}

export const getState = () => data;
export const getStorageState = () => storage;

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((listener) => {
    try {
      listener(data);
    } catch (error) {
      console.error('Nexora: a state subscriber failed', error);
    }
  });
}

function persist() {
  if (!storage.available) return;
  const result = saveData(data);
  storage = { available: true, error: result.ok ? null : result.error };
}

function entry(type, description, entityType, entityId) {
  return { id: uid('activity'), type, description, timestamp: nowIso(), entityType, entityId };
}

/** Replace state, optionally prepend activity entries, save, notify. */
function commit(next, entries = []) {
  const activity = [...entries, ...next.activity].slice(0, MAX_ACTIVITY);
  data = { ...next, activity };
  persist();
  notify();
}

const memberName = (id) => indexById(data.team).get(id)?.name ?? 'Unassigned';

// ---------------------------------------------------------------- projects

export function addProject(input) {
  const check = validateProjectInput(input, { team: data.team });
  if (!check.valid) return { ok: false, errors: check.errors };
  const now = nowIso();
  const project = { id: uid('project'), ...check.value, previousStatus: null, createdAt: now, updatedAt: now };
  commit({ ...data, projects: [project, ...data.projects] }, [
    entry('project_created', `Created project “${project.name}”`, 'project', project.id),
  ]);
  return { ok: true, item: project };
}

export function updateProject(id, patch) {
  const current = data.projects.find((p) => p.id === id);
  if (!current) return { ok: false, errors: { _form: 'That project no longer exists.' } };
  const check = validateProjectInput({ ...current, ...patch }, { team: data.team });
  if (!check.valid) return { ok: false, errors: check.errors };

  const keys = ['name', 'description', 'ownerId', 'status', 'startDate', 'dueDate', 'color'];
  if (keys.every((key) => check.value[key] === current[key])) return { ok: true, item: current, changed: false };

  const next = { ...current, ...check.value, updatedAt: nowIso() };
  if (next.status === 'archived' && current.status !== 'archived') next.previousStatus = current.status;
  if (next.status !== 'archived') next.previousStatus = null;
  if (next.status === 'archived' && !next.previousStatus) next.previousStatus = 'active';

  commit({ ...data, projects: data.projects.map((p) => (p.id === id ? next : p)) }, [
    entry('project_updated', `Updated project “${next.name}”`, 'project', id),
  ]);
  return { ok: true, item: next, changed: true };
}

export function archiveProject(id) {
  const current = data.projects.find((p) => p.id === id);
  if (!current || current.status === 'archived') return { ok: false };
  const next = { ...current, status: 'archived', previousStatus: current.status, updatedAt: nowIso() };
  commit({ ...data, projects: data.projects.map((p) => (p.id === id ? next : p)) }, [
    entry('project_archived', `Archived project “${current.name}”`, 'project', id),
  ]);
  return { ok: true, item: next };
}

export function restoreProject(id) {
  const current = data.projects.find((p) => p.id === id);
  if (!current || current.status !== 'archived') return { ok: false };
  const next = { ...current, status: current.previousStatus ?? 'active', previousStatus: null, updatedAt: nowIso() };
  commit({ ...data, projects: data.projects.map((p) => (p.id === id ? next : p)) }, [
    entry('project_restored', `Restored project “${current.name}”`, 'project', id),
  ]);
  return { ok: true, item: next };
}

/** Deleting a project also deletes its tasks (the confirmation dialog says so). */
export function deleteProject(id) {
  const current = data.projects.find((p) => p.id === id);
  if (!current) return { ok: false };
  const removed = data.tasks.filter((t) => t.projectId === id).length;
  commit(
    { ...data, projects: data.projects.filter((p) => p.id !== id), tasks: data.tasks.filter((t) => t.projectId !== id) },
    [entry('project_deleted', `Deleted project “${current.name}”${removed ? ` and ${removed} ${removed === 1 ? 'task' : 'tasks'}` : ''}`, 'project', id)],
  );
  return { ok: true, removedTasks: removed };
}

// ------------------------------------------------------------------- tasks

export function addTask(input) {
  const check = validateTaskInput(input, { projects: data.projects, team: data.team });
  if (!check.valid) return { ok: false, errors: check.errors };
  const now = nowIso();
  const task = {
    id: uid('task'),
    ...check.value,
    createdAt: now,
    updatedAt: now,
    completedAt: check.value.status === 'done' ? now : null,
  };
  commit({ ...data, tasks: [task, ...data.tasks] }, [entry('task_created', `Created task “${task.title}”`, 'task', task.id)]);
  return { ok: true, item: task };
}

export function updateTask(id, patch) {
  const current = data.tasks.find((t) => t.id === id);
  if (!current) return { ok: false, errors: { _form: 'That task no longer exists.' } };
  const check = validateTaskInput({ ...current, ...patch }, { projects: data.projects, team: data.team });
  if (!check.valid) return { ok: false, errors: check.errors };

  const v = check.value;
  const sameTags = v.tags.length === current.tags.length && v.tags.every((tag, i) => tag === current.tags[i]);
  const statusChanged = v.status !== current.status;
  const assigneeChanged = v.assigneeId !== current.assigneeId;
  const otherChanged =
    v.title !== current.title ||
    v.description !== current.description ||
    v.projectId !== current.projectId ||
    v.priority !== current.priority ||
    v.dueDate !== current.dueDate ||
    !sameTags;
  if (!statusChanged && !assigneeChanged && !otherChanged) return { ok: true, item: current, changed: false };

  const now = nowIso();
  const next = { ...current, ...v, updatedAt: now };
  if (statusChanged) next.completedAt = v.status === 'done' ? now : null;

  const entries = [];
  if (statusChanged) {
    entries.push(
      v.status === 'done'
        ? entry('task_completed', `Completed “${v.title}”`, 'task', id)
        : entry('task_moved', `Moved “${v.title}” from ${statusLabel(current.status)} to ${statusLabel(v.status)}`, 'task', id),
    );
  }
  if (assigneeChanged) {
    entries.push(entry('task_reassigned', `Reassigned “${v.title}” from ${memberName(current.assigneeId)} to ${memberName(v.assigneeId)}`, 'task', id));
  }
  if (otherChanged) {
    entries.push(entry('task_updated', `Updated task “${v.title}”`, 'task', id));
  }

  commit({ ...data, tasks: data.tasks.map((t) => (t.id === id ? next : t)) }, entries.reverse());
  return { ok: true, item: next, changed: true };
}

export const setTaskStatus = (id, status) => updateTask(id, { status });

export function deleteTask(id) {
  const current = data.tasks.find((t) => t.id === id);
  if (!current) return { ok: false };
  commit({ ...data, tasks: data.tasks.filter((t) => t.id !== id) }, [
    entry('task_deleted', `Deleted task “${current.title}”`, 'task', id),
  ]);
  return { ok: true };
}

// ----------------------------------------------------------- preferences

export function setTheme(theme) {
  if (theme !== 'light' && theme !== 'dark') return { ok: false };
  if (data.preferences.theme === theme) return { ok: true, changed: false };
  commit({ ...data, preferences: { ...data.preferences, theme } });
  return { ok: true, changed: true };
}

export function setDefaultTaskView(view) {
  if (view !== 'all' && view !== 'mine') return { ok: false };
  if (data.preferences.defaultTaskView === view) return { ok: true, changed: false };
  commit({ ...data, preferences: { ...data.preferences, defaultTaskView: view } });
  return { ok: true, changed: true };
}

/** The display name is also the name of the first team member ("you"). */
export function setDisplayName(name) {
  const check = validateDisplayName(name);
  if (!check.valid) return { ok: false, error: check.error };
  if (data.preferences.displayName === check.value) return { ok: true, changed: false };
  const team = data.team.map((m) => (m.id === CURRENT_USER_ID ? { ...m, name: check.value } : m));
  commit({ ...data, team, preferences: { ...data.preferences, displayName: check.value } });
  return { ok: true, changed: true };
}

export function markNotificationsRead(ids) {
  const fresh = ids.filter((id) => !data.notificationsRead.includes(id));
  if (!fresh.length) return;
  commit({ ...data, notificationsRead: [...data.notificationsRead, ...fresh].slice(-MAX_READ_NOTIFICATIONS) });
}

// ------------------------------------------------------- reset and restore

/** Replace everything with fresh demo data. Theme and view preferences are kept. */
export function resetToSeed() {
  const seed = buildSeedData();
  const prefs = { ...seed.preferences, ...data.preferences };
  const team = seed.team.map((m) => (m.id === CURRENT_USER_ID ? { ...m, name: prefs.displayName } : m));
  commit({ ...seed, team, preferences: prefs }, [entry('data_reset', 'Reset workspace to demo data', null, null)]);
}

/** Replace everything with an already validated dataset (from a backup). */
export function replaceAllData(validated) {
  commit({ ...validated, version: SCHEMA_VERSION }, [entry('data_restored', 'Restored workspace from a JSON backup', null, null)]);
}

