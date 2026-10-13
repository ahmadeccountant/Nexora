// Pure functions that derive everything shown in the UI from application state.
// Nothing here touches the DOM or storage, so every metric is calculated from
// current data rather than hard-coded.

import { priorityRank, statusOrder, TASK_STATUSES, PRIORITIES } from './data/constants.js';
import { addDays, daysBetween, formatShortDate, indexById, pluralize, toDateStr, todayStr } from './utils.js';

export const isDone = (task) => task.status === 'done';

export function isOverdue(task, today = todayStr()) {
  return task.status !== 'done' && Boolean(task.dueDate) && task.dueDate < today;
}

/** Tasks that belong to projects that are not archived. */
export function liveTasks(state) {
  const archived = new Set(state.projects.filter((p) => p.status === 'archived').map((p) => p.id));
  return state.tasks.filter((t) => !archived.has(t.projectId));
}

export function projectProgress(projectId, tasks) {
  const related = tasks.filter((t) => t.projectId === projectId);
  const done = related.filter(isDone).length;
  return {
    total: related.length,
    done,
    percent: related.length ? Math.round((done / related.length) * 100) : 0,
  };
}

export function getKpis(state, now = new Date()) {
  const today = toDateStr(now);
  const live = liveTasks(state);
  const done = live.filter(isDone).length;
  const weekStart = addDays(today, -6);
  return {
    totalProjects: state.projects.length,
    activeProjects: state.projects.filter((p) => p.status === 'active').length,
    planningProjects: state.projects.filter((p) => p.status === 'planning').length,
    archivedProjects: state.projects.filter((p) => p.status === 'archived').length,
    liveTasks: live.length,
    openTasks: live.length - done,
    inProgressTasks: live.filter((t) => t.status === 'in-progress').length,
    overdueTasks: live.filter((t) => isOverdue(t, today)).length,
    completedTasks: done,
    completedThisWeek: live.filter((t) => t.completedAt && toDateStr(new Date(t.completedAt)) >= weekStart).length,
    completionPercent: live.length ? Math.round((done / live.length) * 100) : 0,
  };
}

const includesText = (value, query) => String(value ?? '').toLowerCase().includes(query);

export function filterProjects(projects, { query = '', status = 'all', owner = 'all' } = {}, team = []) {
  const q = query.trim().toLowerCase();
  const members = indexById(team);
  return projects.filter((p) => {
    if (status !== 'all' && p.status !== status) return false;
    if (owner !== 'all' && p.ownerId !== owner) return false;
    if (!q) return true;
    return includesText(p.name, q) || includesText(p.description, q) || includesText(members.get(p.ownerId)?.name, q);
  });
}

export function sortProjects(projects, key, tasks = []) {
  const list = [...projects];
  const byName = (a, b) => a.name.localeCompare(b.name);
  switch (key) {
    case 'name':
      return list.sort(byName);
    case 'due':
      return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || byName(a, b));
    case 'progress':
      return list.sort((a, b) => projectProgress(b.id, tasks).percent - projectProgress(a.id, tasks).percent || byName(a, b));
    case 'status': {
      const order = { active: 0, planning: 1, completed: 2, archived: 3 };
      return list.sort((a, b) => order[a.status] - order[b.status] || byName(a, b));
    }
    case 'updated':
    default:
      return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || byName(a, b));
  }
}

export function filterTasks(state, filters = {}, today = todayStr()) {
  const { query = '', project = 'all', status = 'all', priority = 'all', assignee = 'all' } = filters;
  const projects = indexById(state.projects);
  const members = indexById(state.team);
  const q = query.trim().toLowerCase();
  return state.tasks.filter((t) => {
    const parent = projects.get(t.projectId);
    if (project === 'all') {
      if (parent?.status === 'archived') return false;
    } else if (t.projectId !== project) return false;

    if (status === 'open') {
      if (isDone(t)) return false;
    } else if (status === 'overdue') {
      if (!isOverdue(t, today)) return false;
    } else if (status !== 'all' && t.status !== status) return false;

    if (priority !== 'all' && t.priority !== priority) return false;
    if (assignee === 'unassigned') {
      if (t.assigneeId) return false;
    } else if (assignee !== 'all' && t.assigneeId !== assignee) return false;

    if (!q) return true;
    return (
      includesText(t.title, q) ||
      includesText(t.description, q) ||
      t.tags.some((tag) => includesText(tag, q)) ||
      includesText(parent?.name, q) ||
      includesText(members.get(t.assigneeId)?.name, q)
    );
  });
}

export function sortTasks(tasks, key = 'due') {
  const list = [...tasks];
  const byTitle = (a, b) => a.title.localeCompare(b.title);
  const byDue = (a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  };
  const byPriority = (a, b) => priorityRank(b.priority) - priorityRank(a.priority);
  switch (key) {
    case 'priority':
      return list.sort((a, b) => byPriority(a, b) || byDue(a, b) || byTitle(a, b));
    case 'title':
      return list.sort(byTitle);
    case 'status':
      return list.sort((a, b) => statusOrder(a.status) - statusOrder(b.status) || byDue(a, b) || byTitle(a, b));
    case 'due':
    default:
      return list.sort((a, b) => byDue(a, b) || byPriority(a, b) || byTitle(a, b));
  }
}

export function statusCounts(tasks) {
  const counts = Object.fromEntries(TASK_STATUSES.map((s) => [s.id, 0]));
  tasks.forEach((t) => {
    counts[t.status] += 1;
  });
  return counts;
}

export function priorityCounts(tasks) {
  const counts = Object.fromEntries(PRIORITIES.map((p) => [p.id, 0]));
  tasks.forEach((t) => {
    counts[t.priority] += 1;
  });
  return counts;
}

/** Tasks created within the last `days` days (inclusive of today). null means all time. */
export function tasksCreatedInRange(tasks, days, now = new Date()) {
  if (!days) return tasks;
  const start = addDays(toDateStr(now), -(days - 1));
  return tasks.filter((t) => toDateStr(new Date(t.createdAt)) >= start);
}

/** Weekly buckets ending today: completed and created counts per week. */
export function weeklySeries(tasks, weeks, now = new Date()) {
  const today = toDateStr(now);
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const end = addDays(today, -7 * i);
    const start = addDays(end, -6);
    buckets.push({ start, end, label: formatShortDate(start), completed: 0, created: 0 });
  }
  const place = (iso, field) => {
    if (!iso) return;
    const day = toDateStr(new Date(iso));
    const bucket = buckets.find((b) => day >= b.start && day <= b.end);
    if (bucket) bucket[field] += 1;
  };
  tasks.forEach((t) => {
    place(t.completedAt, 'completed');
    place(t.createdAt, 'created');
  });
  return buckets;
}

/** Per-member workload. open excludes overdue so the three counts never overlap. */
export function workloadByMember(tasks, team, today = todayStr()) {
  return team.map((member) => {
    const mine = tasks.filter((t) => t.assigneeId === member.id);
    const done = mine.filter(isDone).length;
    const overdue = mine.filter((t) => isOverdue(t, today)).length;
    return { member, done, overdue, open: mine.length - done - overdue, total: mine.length };
  });
}

export function overdueByProject(tasks, projects, today = todayStr()) {
  return projects
    .map((project) => ({ project, count: tasks.filter((t) => t.projectId === project.id && isOverdue(t, today)).length }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.project.name.localeCompare(b.project.name));
}

export function upcomingDeadlines(tasks, { days = 14, limit = 6 } = {}, today = todayStr()) {
  const horizon = addDays(today, days);
  return tasks
    .filter((t) => !isDone(t) && t.dueDate && t.dueDate <= horizon)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || priorityRank(b.priority) - priorityRank(a.priority))
    .slice(0, limit);
}

/**
 * Notifications come from real local data only: overdue and soon-due work.
 * Nothing is emailed or pushed; this is purely an in-app list.
 */
export function buildNotifications(state, today = todayStr()) {
  const read = new Set(state.notificationsRead);
  const projects = indexById(state.projects);
  const items = [];

  for (const task of liveTasks(state)) {
    if (isDone(task) || !task.dueDate) continue;
    const diff = daysBetween(today, task.dueDate);
    const projectName = projects.get(task.projectId)?.name ?? 'Unknown project';
    if (diff < 0) {
      items.push({
        id: `task-overdue:${task.id}:${task.dueDate}`,
        kind: 'overdue',
        title: task.title,
        detail: `${pluralize(-diff, 'day')} overdue · ${projectName}`,
        route: `tasks/${task.id}`,
        sortKey: task.dueDate,
      });
    } else if (diff <= 3) {
      items.push({
        id: `task-soon:${task.id}:${task.dueDate}`,
        kind: 'soon',
        title: task.title,
        detail: `${diff === 0 ? 'Due today' : diff === 1 ? 'Due tomorrow' : `Due in ${diff} days`} · ${projectName}`,
        route: `tasks/${task.id}`,
        sortKey: task.dueDate,
      });
    }
  }

  for (const project of state.projects) {
    if (project.status === 'archived' || project.status === 'completed') continue;
    const diff = daysBetween(today, project.dueDate);
    if (diff < 0) {
      items.push({
        id: `project-overdue:${project.id}:${project.dueDate}`,
        kind: 'overdue',
        title: `Project “${project.name}”`,
        detail: `Past its due date by ${pluralize(-diff, 'day')}`,
        route: `projects/${project.id}`,
        sortKey: project.dueDate,
      });
    } else if (diff <= 7) {
      items.push({
        id: `project-soon:${project.id}:${project.dueDate}`,
        kind: 'soon',
        title: `Project “${project.name}”`,
        detail: diff === 0 ? 'Due today' : `Due in ${pluralize(diff, 'day')}`,
        route: `projects/${project.id}`,
        sortKey: project.dueDate,
      });
    }
  }

  return items
    .map((item) => ({ ...item, read: read.has(item.id) }))
    .sort((a, b) => (a.kind === b.kind ? a.sortKey.localeCompare(b.sortKey) : a.kind === 'overdue' ? -1 : 1));
}
