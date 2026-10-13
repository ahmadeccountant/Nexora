// Analytics: charts derived from current state, filtered by a date range.
// The range applies to when tasks were created; weekly completion is
// charted by completion date; project progress always uses all tasks.

import { CHART_COLORS, PRIORITIES, TASK_STATUSES } from '../data/constants.js';
import { axisOptions, createChartCard, destroyAllCharts, legendOptions, renderChart } from '../components/charts.js';
import { createField } from '../components/form.js';
import { refreshIcons } from '../components/ui.js';
import { isOverdue, liveTasks, overdueByProject, priorityCounts, projectProgress, statusCounts, tasksCreatedInRange, weeklySeries, workloadByMember } from '../selectors.js';
import { getState } from '../state.js';
import { h, todayStr } from '../utils.js';

const RANGES = [
  { value: '7', label: 'Last 7 days', days: 7, weeks: 4 },
  { value: '30', label: 'Last 30 days', days: 30, weeks: 5 },
  { value: '90', label: 'Last 90 days', days: 90, weeks: 13 },
  { value: 'all', label: 'All time', days: null, weeks: 12 },
];
const ui = { range: 'all' };

export function createAnalyticsView() {
  let rangeField;
  let statsRow;
  let cards;

  function mount(container) {
    rangeField = createField({ name: 'range', label: 'Date range', type: 'select', value: ui.range, options: RANGES.map((r) => ({ value: r.value, label: r.label })) });
    rangeField.input.addEventListener('change', () => {
      ui.range = rangeField.getValue();
      update();
    });
    statsRow = h('div', { class: 'analytics-stats' });
    cards = {
      status: createChartCard({ title: 'Task status', description: 'Tasks created in range', height: 260 }),
      priority: createChartCard({ title: 'Priority distribution', description: 'Tasks created in range', height: 260 }),
      progress: createChartCard({ title: 'Project progress', description: 'Share of tasks done, all tasks', height: 260 }),
      weekly: createChartCard({ title: 'Weekly task completion', description: 'Completed and created per week', height: 260 }),
      overdue: createChartCard({ title: 'Overdue tasks', description: 'Open tasks past their due date, by project', height: 260 }),
      workload: createChartCard({ title: 'Team workload', description: 'Tasks per person in range', height: 300 }),
    };
    container.replaceChildren(
      h(
        'div',
        {},
        h('div', { class: 'page-header' }, h('p', { class: 'page-lede' }, 'The date range filters by when tasks were created. Weekly completion uses completion dates, and project progress always counts every task. Archived projects are excluded.'), h('div', { style: { minWidth: '12rem' } }, rangeField.el)),
        statsRow,
        h(
          'div',
          { class: 'grid' },
          h('div', { class: 'span-4' }, cards.status.el),
          h('div', { class: 'span-4' }, cards.priority.el),
          h('div', { class: 'span-4' }, cards.overdue.el),
          h('div', { class: 'span-6' }, cards.weekly.el),
          h('div', { class: 'span-6' }, cards.progress.el),
          h('div', { class: 'span-12' }, cards.workload.el),
        ),
      ),
    );
  }

  function stat(value, label) {
    return h('div', { class: 'stat-card' }, h('strong', {}, String(value)), h('span', {}, label));
  }

  function update() {
    const state = getState();
    const range = RANGES.find((r) => r.value === ui.range) ?? RANGES[3];
    const now = new Date();
    const today = todayStr();
    const live = liveTasks(state);
    const inRange = tasksCreatedInRange(live, range.days, now);
    const done = inRange.filter((t) => t.status === 'done').length;
    const overdue = inRange.filter((t) => isOverdue(t, today)).length;

    statsRow.replaceChildren(
      stat(inRange.length, 'Tasks created in range'),
      stat(done, 'Completed'),
      stat(overdue, 'Overdue'),
      stat(inRange.length ? `${Math.round((done / inRange.length) * 100)}%` : '0%', 'Completion rate'),
    );

    const empty = inRange.length === 0;
    const emptyText = 'No tasks were created in this range.';

    const statuses = statusCounts(inRange);
    renderChart('analytics:status', cards.status, {
      type: 'doughnut',
      isEmpty: empty,
      emptyText,
      summary: TASK_STATUSES.map((s) => `${s.label}: ${statuses[s.id]}`).join(', '),
      data: {
        labels: TASK_STATUSES.map((s) => s.label),
        datasets: [{ data: TASK_STATUSES.map((s) => statuses[s.id]), backgroundColor: TASK_STATUSES.map((s) => CHART_COLORS.status[s.id]), borderWidth: 2, borderColor: getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim() || '#fff' }],
      },
      options: { cutout: '60%', plugins: legendOptions('bottom') },
    });

    const priorities = priorityCounts(inRange);
    renderChart('analytics:priority', cards.priority, {
      type: 'bar',
      isEmpty: empty,
      emptyText,
      summary: PRIORITIES.map((p) => `${p.label}: ${priorities[p.id]}`).join(', '),
      data: { labels: PRIORITIES.map((p) => p.label), datasets: [{ label: 'Tasks', data: PRIORITIES.map((p) => priorities[p.id]), backgroundColor: PRIORITIES.map((p) => CHART_COLORS.priority[p.id]), borderRadius: 6 }] },
      options: { ...axisOptions(), plugins: { legend: { display: false } } },
    });

    const overdueRows = overdueByProject(inRange, state.projects.filter((p) => p.status !== 'archived'), today);
    renderChart('analytics:overdue', cards.overdue, {
      type: 'bar',
      isEmpty: overdueRows.length === 0,
      emptyText: 'No overdue tasks in this range. Nice work.',
      summary: overdueRows.map((r) => `${r.project.name}: ${r.count}`).join(', '),
      data: { labels: overdueRows.map((r) => r.project.name), datasets: [{ label: 'Overdue tasks', data: overdueRows.map((r) => r.count), backgroundColor: CHART_COLORS.overdue, borderRadius: 6 }] },
      options: { ...axisOptions({ horizontal: true }), plugins: { legend: { display: false } } },
    });

    const weeks = weeklySeries(live, range.weeks, now);
    renderChart('analytics:weekly', cards.weekly, {
      type: 'line',
      isEmpty: weeks.every((w) => w.completed === 0 && w.created === 0),
      emptyText: 'No task activity in this range.',
      summary: weeks.map((w) => `week of ${w.label}: ${w.completed} completed, ${w.created} created`).join('; '),
      data: {
        labels: weeks.map((w) => w.label),
        datasets: [
          { label: 'Completed', data: weeks.map((w) => w.completed), borderColor: CHART_COLORS.done, backgroundColor: CHART_COLORS.done, tension: 0.3, pointStyle: 'circle', pointRadius: 4 },
          { label: 'Created', data: weeks.map((w) => w.created), borderColor: CHART_COLORS.open, backgroundColor: CHART_COLORS.open, borderDash: [6, 4], tension: 0.3, pointStyle: 'rect', pointRadius: 4 },
        ],
      },
      options: { ...axisOptions(), plugins: legendOptions('bottom') },
    });

    const projects = state.projects.filter((p) => p.status !== 'archived');
    const progress = projects.map((p) => projectProgress(p.id, state.tasks));
    renderChart('analytics:progress', cards.progress, {
      type: 'bar',
      isEmpty: projects.length === 0,
      emptyText: 'No projects yet.',
      summary: projects.map((p, i) => `${p.name}: ${progress[i].percent}%`).join(', '),
      data: { labels: projects.map((p) => p.name), datasets: [{ label: 'Progress (%)', data: progress.map((p) => p.percent), backgroundColor: projects.map((p) => p.color), borderRadius: 6 }] },
      options: { ...axisOptions({ horizontal: true, max: 100 }), plugins: { legend: { display: false } } },
    });

    const workload = workloadByMember(inRange, state.team, today);
    renderChart('analytics:workload', cards.workload, {
      type: 'bar',
      isEmpty: empty,
      emptyText,
      summary: workload.map((w) => `${w.member.name}: ${w.open} open, ${w.overdue} overdue, ${w.done} done`).join('; '),
      data: {
        labels: workload.map((w) => w.member.name),
        datasets: [
          { label: 'Open', data: workload.map((w) => w.open), backgroundColor: CHART_COLORS.open, borderRadius: 4 },
          { label: 'Overdue', data: workload.map((w) => w.overdue), backgroundColor: CHART_COLORS.overdue, borderRadius: 4 },
          { label: 'Done', data: workload.map((w) => w.done), backgroundColor: CHART_COLORS.done, borderRadius: 4 },
        ],
      },
      options: { ...axisOptions({ stacked: true }), plugins: legendOptions('bottom') },
    });
    refreshIcons();
  }

  return { mount, update, unmount: destroyAllCharts };
}
