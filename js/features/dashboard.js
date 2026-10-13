// Overview dashboard. Every number and chart is derived from current state.

import { CHART_COLORS, PRIORITIES, TASK_STATUSES } from '../data/constants.js';
import { axisOptions, createChartCard, destroyAllCharts, legendOptions, renderChart } from '../components/charts.js';
import { avatar, button, dueBadge, emptyState, icon, priorityBadge, progressBar, projectDot, projectStatusBadge, refreshIcons, section } from '../components/ui.js';
import { getKpis, liveTasks, priorityCounts, projectProgress, statusCounts, upcomingDeadlines, weeklySeries } from '../selectors.js';
import { navigate } from '../router.js';
import { getState } from '../state.js';
import { dueInfo, formatShortDate, h, indexById, pluralize, todayStr } from '../utils.js';
import { openActivityModal, renderActivityList } from './activity.js';
import { openProjectForm } from './projects.js';
import { openTaskDetails, openTaskForm, setTaskFilters } from './tasks.js';

function greeting(now = new Date()) {
  const hour = now.getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export function createDashboardView() {
  let titleEl;
  let kpiGrid;
  let progressBody;
  let deadlinesBody;
  let activityBody;
  let statusCard;
  let priorityCard;
  let weeklyCard;

  function kpi({ label, value, note, iconName, tone, onclick }) {
    return h(
      'button',
      { type: 'button', class: 'kpi', onclick },
      h('span', { class: 'kpi-top' }, h('span', {}, label), h('span', { class: `kpi-icon${tone === 'danger' ? ' kpi-icon-danger' : tone === 'success' ? ' kpi-icon-success' : ''}` }, icon(iconName))),
      h('span', { class: `kpi-value${tone === 'danger' && Number.parseInt(value, 10) > 0 ? ' kpi-value-danger' : ''}` }, value),
      h('span', { class: 'kpi-note' }, note),
    );
  }

  function mount(container) {
    titleEl = h('h2', { class: 'greeting-title' });
    kpiGrid = h('div', { class: 'kpi-grid' });
    statusCard = createChartCard({ title: 'Task status', description: 'Tasks in active projects', height: 230 });
    priorityCard = createChartCard({ title: 'Priority', description: 'Open and done tasks by priority', height: 230 });
    weeklyCard = createChartCard({ title: 'Weekly productivity', description: 'Tasks completed per week, last 6 weeks', height: 230 });
    progressBody = h('div');
    deadlinesBody = h('div');
    activityBody = h('div');

    container.replaceChildren(
      h(
        'div',
        {},
        h(
          'div',
          { class: 'page-header' },
          h('div', {}, titleEl, h('p', { class: 'page-lede' }, new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }))),
          h(
            'div',
            { class: 'page-actions' },
            button({ label: 'New project', icon: 'folder-plus', variant: 'secondary', onclick: () => openProjectForm() }),
            button({ label: 'New task', icon: 'plus', variant: 'primary', onclick: () => openTaskForm() }),
          ),
        ),
        kpiGrid,
        h(
          'div',
          { class: 'grid' },
          h('div', { class: 'span-6' }, weeklyCard.el),
          h('div', { class: 'span-3' }, statusCard.el),
          h('div', { class: 'span-3' }, priorityCard.el),
          h('div', { class: 'span-4' }, section('Project progress', {}, progressBody)),
          h('div', { class: 'span-4' }, section('Upcoming deadlines', { description: 'Overdue and due in the next 14 days' }, deadlinesBody)),
          h(
            'div',
            { class: 'span-4' },
            section('Recent activity', { actions: button({ label: 'View all', variant: 'ghost', onclick: openActivityModal, attrs: { class: 'btn btn-ghost btn-sm' } }) }, activityBody),
          ),
        ),
      ),
    );
  }

  function update() {
    const state = getState();
    const now = new Date();
    const today = todayStr();
    const kpis = getKpis(state, now);
    const live = liveTasks(state);
    const members = indexById(state.team);
    const projects = indexById(state.projects);

    titleEl.textContent = `${greeting(now)}, ${state.preferences.displayName.split(' ')[0]}`;

    kpiGrid.replaceChildren(
      kpi({ label: 'Total projects', value: String(kpis.totalProjects), note: kpis.archivedProjects ? `${kpis.archivedProjects} archived` : 'None archived', iconName: 'folder-kanban', onclick: () => navigate('projects') }),
      kpi({ label: 'Active projects', value: String(kpis.activeProjects), note: `${kpis.planningProjects} in planning`, iconName: 'play', onclick: () => navigate('projects') }),
      kpi({ label: 'Open tasks', value: String(kpis.openTasks), note: `${kpis.inProgressTasks} in progress`, iconName: 'list-checks', onclick: () => { setTaskFilters({ status: 'open' }); navigate('tasks'); } }),
      kpi({ label: 'Overdue tasks', value: String(kpis.overdueTasks), note: kpis.overdueTasks ? 'Needs attention' : 'Everything on schedule', iconName: 'triangle-alert', tone: 'danger', onclick: () => { setTaskFilters({ status: 'overdue' }); navigate('tasks'); } }),
      kpi({ label: 'Completed tasks', value: String(kpis.completedTasks), note: `${kpis.completedThisWeek} in the last 7 days`, iconName: 'circle-check', tone: 'success', onclick: () => { setTaskFilters({ status: 'done' }); navigate('tasks'); } }),
      kpi({ label: 'Completion rate', value: `${kpis.completionPercent}%`, note: `${kpis.completedTasks} of ${pluralize(kpis.liveTasks, 'task')}`, iconName: 'target', tone: 'success', onclick: () => navigate('analytics') }),
    );

    // Charts
    const statuses = statusCounts(live);
    renderChart('dashboard:status', statusCard, {
      type: 'doughnut',
      isEmpty: live.length === 0,
      emptyText: 'No tasks yet. Create one to see its status here.',
      summary: TASK_STATUSES.map((s) => `${s.label}: ${statuses[s.id]}`).join(', '),
      data: {
        labels: TASK_STATUSES.map((s) => s.label),
        datasets: [{ data: TASK_STATUSES.map((s) => statuses[s.id]), backgroundColor: TASK_STATUSES.map((s) => CHART_COLORS.status[s.id]), borderWidth: 2, borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim() || '#fff' }],
      },
      options: { cutout: '62%', plugins: legendOptions('bottom') },
    });

    const priorities = priorityCounts(live);
    renderChart('dashboard:priority', priorityCard, {
      type: 'bar',
      isEmpty: live.length === 0,
      emptyText: 'No tasks yet.',
      summary: PRIORITIES.map((p) => `${p.label}: ${priorities[p.id]}`).join(', '),
      data: {
        labels: PRIORITIES.map((p) => p.label),
        datasets: [{ label: 'Tasks', data: PRIORITIES.map((p) => priorities[p.id]), backgroundColor: PRIORITIES.map((p) => CHART_COLORS.priority[p.id]), borderRadius: 6 }],
      },
      options: { ...axisOptions(), plugins: { legend: { display: false } } },
    });

    const weeks = weeklySeries(live, 6, now);
    const totalCompleted = weeks.reduce((sum, w) => sum + w.completed, 0);
    renderChart('dashboard:weekly', weeklyCard, {
      type: 'bar',
      isEmpty: totalCompleted === 0,
      emptyText: 'Nothing completed in the last 6 weeks yet.',
      summary: weeks.map((w) => `week of ${w.label}: ${w.completed}`).join(', '),
      data: {
        labels: weeks.map((w) => w.label),
        datasets: [{ label: 'Completed', data: weeks.map((w) => w.completed), backgroundColor: CHART_COLORS.open, borderRadius: 6 }],
      },
      options: { ...axisOptions(), plugins: { legend: { display: false } } },
    });

    // Project progress
    const active = state.projects
      .filter((p) => p.status !== 'archived')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 6);
    progressBody.replaceChildren(
      active.length
        ? h(
            'div',
            {},
            active.map((project) => {
              const progress = projectProgress(project.id, state.tasks);
              return h(
                'div',
                { class: 'project-progress-item' },
                h(
                  'div',
                  { class: 'project-progress-top' },
                  h('div', { class: 'project-progress-name' }, projectDot(project.color), h('button', { type: 'button', class: 'link-btn', onclick: () => navigate(`projects/${project.id}`) }, project.name)),
                  projectStatusBadge(project.status),
                ),
                progressBar(progress.percent, { color: project.color, label: `${project.name} progress` }),
                h('div', { class: 'project-progress-meta' }, h('span', {}, `${progress.done}/${progress.total} tasks · ${progress.percent}%`), h('span', {}, `Due ${formatShortDate(project.dueDate)}`)),
              );
            }),
          )
        : emptyState({ iconName: 'folder-plus', title: 'No projects yet', text: 'Create a project to track its progress here.', actions: [button({ label: 'New project', icon: 'plus', variant: 'primary', onclick: () => openProjectForm() })] }),
    );

    // Deadlines
    const deadlines = upcomingDeadlines(live, { days: 14, limit: 6 }, today);
    deadlinesBody.replaceChildren(
      deadlines.length
        ? h(
            'ul',
            { class: 'list' },
            deadlines.map((task) => {
              const project = projects.get(task.projectId);
              const assignee = members.get(task.assigneeId);
              return h(
                'li',
                {},
                avatar(assignee, { size: 'sm', labelled: true }),
                h(
                  'div',
                  { class: 'list-main' },
                  h('button', { type: 'button', class: 'link-btn list-title', onclick: () => openTaskDetails(task.id) }, task.title),
                  h('div', { class: 'list-meta' }, project ? [projectDot(project.color), project.name] : null),
                  h('div', { class: 'list-meta' }, dueBadge(dueInfo(task.dueDate, false, today)), priorityBadge(task.priority)),
                ),
              );
            }),
          )
        : emptyState({ iconName: 'calendar-check', title: 'No deadlines coming up', text: 'Nothing is overdue or due in the next two weeks.' }),
    );

    // Activity
    activityBody.replaceChildren(renderActivityList(state.activity, { limit: 6 }));
    refreshIcons();
  }

  function unmount() {
    destroyAllCharts();
  }

  return { mount, update, unmount };
}

