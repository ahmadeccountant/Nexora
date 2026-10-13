// Demo data. All people, emails and projects are fictional.
// Dates are generated relative to "today" so overdue, upcoming and completed
// work always demonstrates the dashboard, whenever the app is first opened.

import { DEFAULT_PREFERENCES, SCHEMA_VERSION } from './constants.js';
import { addDays, toDateStr } from '../utils.js';

const pad = (n, width = 3) => String(n).padStart(width, '0');

const TEAM = [
  ['Alex Morgan', 'Product Manager', '#6257E8', 'available'],
  ['Priya Nair', 'Frontend Developer', '#0F766E', 'available'],
  ['Marcus Chen', 'Product Designer', '#B45309', 'busy'],
  ['Sofia Alvarez', 'QA Engineer', '#BE185D', 'available'],
  ['Daniel Okafor', 'Backend Developer', '#1D4ED8', 'away'],
  ['Hannah Weiss', 'Marketing Lead', '#15803D', 'busy'],
];

// [name, description, ownerIndex, status, startOffset, dueOffset, color, previousStatus]
const PROJECTS = [
  ['Website Redesign', 'Refresh the company website with a clearer story and faster pages.', 2, 'active', -30, 25, '#6257E8'],
  ['Mobile App Launch', 'Ship version 1.0 of the mobile app to both app stores.', 1, 'active', -45, 40, '#0F766E'],
  ['Customer Onboarding Flow', 'Research and design a smoother first-week experience for new customers.', 3, 'planning', 3, 60, '#B45309'],
  ['Q3 Marketing Campaign', 'Plan, launch and report on the quarterly campaign.', 6, 'completed', -90, -10, '#BE185D'],
  ['API Platform Migration', 'Move partners from the legacy API to the new platform.', 5, 'active', -20, 14, '#1D4ED8'],
  ['Brand Guidelines Refresh', 'Update logo, color and tone-of-voice guidance.', 3, 'archived', -120, -40, '#7C3AED', 'completed'],
];

// [projectIndex, title, description, assigneeIndex (0 = unassigned), status, priority, dueOffset, tags, createdOffset, completedOffset]
const TASKS = [
  [1, 'Audit current site content', 'Inventory every page and flag outdated copy.', 4, 'done', 'medium', -18, ['Research'], -30, -20],
  [1, 'Design new homepage wireframes', 'Low-fidelity layouts for desktop and mobile.', 3, 'done', 'high', -10, ['Design'], -28, -12],
  [1, 'Build responsive landing page', 'Implement the approved landing page layout.', 2, 'in-progress', 'high', 4, ['Frontend', 'Design'], -14],
  [1, 'Implement navigation component', 'Accessible, keyboard-friendly main navigation.', 2, 'in-review', 'medium', 2, ['Frontend'], -10],
  [1, 'Set up analytics tracking', 'Add page-view and conversion events.', 5, 'todo', 'low', 12, ['Analytics'], -8],
  [1, 'Accessibility review', 'Check contrast, focus order and screen reader labels.', 4, 'todo', 'high', -3, ['QA', 'Accessibility'], -12],
  [2, 'Finalize app store listing', 'Screenshots, description and keywords.', 6, 'in-progress', 'medium', 6, ['Marketing'], -9],
  [2, 'Fix push permission crash', 'App crashes when notification permission is denied.', 5, 'in-progress', 'urgent', -1, ['Bug', 'Backend'], -6],
  [2, 'Draft beta tester guide', 'Short guide explaining what to test and how to report issues.', 1, 'done', 'medium', -6, ['Docs'], -25, -5],
  [2, 'Offline mode QA pass', 'Verify sync behavior with flaky connections.', 4, 'todo', 'high', 9, ['QA'], -7],
  [2, 'Release candidate build', 'Cut and sign the release candidate.', 2, 'in-review', 'urgent', 5, ['Release'], -5],
  [2, 'Performance profiling', 'Find and fix the slowest screens on mid-range devices.', 5, 'done', 'high', -15, ['Performance'], -30, -16],
  [2, 'Prepare sprint demo', 'Slides and a short walkthrough for stakeholders.', 1, 'done', 'low', -2, ['Docs'], -9, -2],
  [3, 'Map onboarding user journey', 'Document each step from sign-up to first project.', 1, 'todo', 'medium', 10, ['Research'], -3],
  [3, 'Define success metrics', 'Pick the activation numbers we will track.', 3, 'todo', 'low', 14, ['Analytics'], -2],
  [3, 'Interview five new customers', 'Schedule and run short discovery calls.', 1, 'in-progress', 'high', 8, ['Research'], -4],
  [4, 'Launch email campaign', 'Send the main campaign to the full list.', 6, 'done', 'high', -30, ['Marketing'], -80, -31],
  [4, 'Publish case study', 'Customer story for the website and newsletter.', 6, 'done', 'medium', -22, ['Marketing', 'Content'], -70, -24],
  [4, 'Campaign performance report', 'Summarize results and lessons learned.', 1, 'done', 'medium', -12, ['Analytics'], -40, -13],
  [5, 'Document legacy endpoints', 'List every endpoint and who still uses it.', 5, 'done', 'medium', -8, ['Docs', 'Backend'], -20, -9],
  [5, 'Migrate authentication service', 'Move token issuing to the new platform.', 5, 'in-progress', 'urgent', 3, ['Backend', 'Security'], -12],
  [5, 'Write integration tests', 'Cover the migrated endpoints end to end.', 4, 'in-review', 'high', 1, ['QA', 'Backend'], -9],
  [5, 'Update API client library', 'Point the client library at the new platform.', 2, 'todo', 'medium', 11, ['Frontend'], -6],
  [5, 'Send deprecation notice to partners', 'Draft the notice with the new timeline.', 1, 'todo', 'high', -2, ['Comms'], -10],
  [5, 'Set up staging environment', 'Mirror production for migration rehearsals.', 5, 'done', 'medium', -4, ['Backend'], -14, -4],
  [6, 'Revise logo usage rules', 'Clear-space, minimum size and misuse examples.', 3, 'done', 'low', -50, ['Design'], -100, -52],
  [6, 'Update color palette doc', 'Add accessible color pairings.', 3, 'done', 'low', -45, ['Design'], -95, -47],
  [3, 'Choose icon style', 'Pick a single icon family for product and marketing.', 0, 'todo', 'low', 20, ['Design'], -3],
];

export function buildSeedData(now = new Date()) {
  const today = toDateStr(now);
  const at = (offsetDays, hour = 9) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offsetDays);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const ago = (ms) => new Date(now.getTime() - ms).toISOString();

  const team = TEAM.map(([name, role, color, status], i) => ({
    id: `member_${pad(i + 1)}`,
    name,
    role,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@nexora.example`,
    color,
    status,
  }));

  const projects = PROJECTS.map(([name, description, owner, status, start, due, color, previous], i) => ({
    id: `project_${pad(i + 1)}`,
    name,
    description,
    ownerId: team[owner - 1].id,
    status,
    previousStatus: status === 'archived' ? previous ?? 'active' : null,
    startDate: addDays(today, start),
    dueDate: addDays(today, due),
    color,
    createdAt: at(start),
    updatedAt: at(Math.min(0, start + 5)),
  }));

  const tasks = TASKS.map(([projectIndex, title, description, assignee, status, priority, due, tags, created, completed], i) => {
    const createdAt = at(created ?? -7);
    return {
      id: `task_${pad(i + 1)}`,
      projectId: projects[projectIndex - 1].id,
      title,
      description,
      assigneeId: assignee ? team[assignee - 1].id : '',
      status,
      priority,
      dueDate: addDays(today, due),
      tags,
      createdAt,
      updatedAt: status === 'done' ? at(completed, 15) : createdAt,
      completedAt: status === 'done' ? at(completed, 15) : null,
    };
  });

  const task = (n) => tasks[n - 1];
  const project = (n) => projects[n - 1];
  const entries = [
    ['task_completed', `Completed “${task(13).title}”`, 'task', task(13).id, 26 * 3600e3],
    ['task_moved', `Moved “${task(4).title}” from In Progress to In Review`, 'task', task(4).id, 5 * 3600e3],
    ['task_reassigned', `Reassigned “${task(22).title}” from Priya Nair to Sofia Alvarez`, 'task', task(22).id, 9 * 3600e3],
    ['task_created', `Created task “${task(28).title}”`, 'task', task(28).id, 3 * 86400e3],
    ['task_completed', `Completed “${task(25).title}”`, 'task', task(25).id, 4 * 86400e3],
    ['project_updated', `Updated project “${project(5).name}”`, 'project', project(5).id, 5 * 86400e3],
    ['task_moved', `Moved “${task(8).title}” from To Do to In Progress`, 'task', task(8).id, 6 * 86400e3],
    ['project_created', `Created project “${project(3).name}”`, 'project', project(3).id, 7 * 86400e3],
    ['project_archived', `Archived project “${project(6).name}”`, 'project', project(6).id, 9 * 86400e3],
  ];
  const activity = entries.map(([type, description, entityType, entityId, delta], i) => ({
    id: `activity_${pad(i + 1)}`,
    type,
    description,
    timestamp: ago(delta),
    entityType,
    entityId,
  }));

  return {
    version: SCHEMA_VERSION,
    team,
    projects,
    tasks,
    activity,
    preferences: { ...DEFAULT_PREFERENCES },
    notificationsRead: [],
  };
}
