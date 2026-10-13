// CSV and JSON export. Downloads are reported honestly: success is only
// returned when the browser actually accepted the download.

import { SCHEMA_VERSION } from '../data/constants.js';
import { priorityLabel, projectStatusLabel, statusLabel } from '../data/constants.js';
import { isOverdue, projectProgress } from '../selectors.js';
import { dateStamp, downloadBlob, indexById, nowIso } from '../utils.js';

/** Quote cells that contain commas, quotes or line breaks; neutralise spreadsheet formulas. */
export function escapeCsvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns, rows) {
  const header = columns.map((c) => escapeCsvCell(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCsvCell(c.value(row))).join(','));
  return [header, ...lines].join('\r\n');
}

export function projectsCsv(state) {
  const members = indexById(state.team);
  return toCsv(
    [
      { label: 'ID', value: (p) => p.id },
      { label: 'Name', value: (p) => p.name },
      { label: 'Description', value: (p) => p.description },
      { label: 'Status', value: (p) => projectStatusLabel(p.status) },
      { label: 'Owner', value: (p) => members.get(p.ownerId)?.name ?? '' },
      { label: 'Start date', value: (p) => p.startDate },
      { label: 'Due date', value: (p) => p.dueDate },
      { label: 'Tasks', value: (p) => projectProgress(p.id, state.tasks).total },
      { label: 'Tasks done', value: (p) => projectProgress(p.id, state.tasks).done },
      { label: 'Progress %', value: (p) => projectProgress(p.id, state.tasks).percent },
      { label: 'Created', value: (p) => p.createdAt },
      { label: 'Updated', value: (p) => p.updatedAt },
    ],
    state.projects,
  );
}

export function tasksCsv(state) {
  const members = indexById(state.team);
  const projects = indexById(state.projects);
  return toCsv(
    [
      { label: 'ID', value: (t) => t.id },
      { label: 'Title', value: (t) => t.title },
      { label: 'Description', value: (t) => t.description },
      { label: 'Project', value: (t) => projects.get(t.projectId)?.name ?? '' },
      { label: 'Status', value: (t) => statusLabel(t.status) },
      { label: 'Priority', value: (t) => priorityLabel(t.priority) },
      { label: 'Assignee', value: (t) => members.get(t.assigneeId)?.name ?? 'Unassigned' },
      { label: 'Due date', value: (t) => t.dueDate },
      { label: 'Overdue', value: (t) => (isOverdue(t) ? 'Yes' : 'No') },
      { label: 'Tags', value: (t) => t.tags.join('; ') },
      { label: 'Created', value: (t) => t.createdAt },
      { label: 'Updated', value: (t) => t.updatedAt },
      { label: 'Completed', value: (t) => t.completedAt ?? '' },
    ],
    state.tasks,
  );
}

export function backupJson(state) {
  return JSON.stringify({ app: 'nexora', schemaVersion: SCHEMA_VERSION, exportedAt: nowIso(), data: state }, null, 2);
}

function save(content, mime, filename) {
  try {
    downloadBlob(new Blob([content], { type: mime }), filename);
    return { ok: true, filename };
  } catch (error) {
    return { ok: false, filename, error: error instanceof Error ? error.message : 'The browser blocked the download.' };
  }
}

export const exportProjectsCsv = (state) => save(`\uFEFF${projectsCsv(state)}`, 'text/csv;charset=utf-8', `nexora-projects-${dateStamp()}.csv`);
export const exportTasksCsv = (state) => save(`\uFEFF${tasksCsv(state)}`, 'text/csv;charset=utf-8', `nexora-tasks-${dateStamp()}.csv`);
export const exportJsonBackup = (state) => save(backupJson(state), 'application/json', `nexora-backup-${dateStamp()}.json`);
