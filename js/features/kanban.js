// Kanban board: four status columns, HTML5 drag-and-drop, and a keyboard /
// touch accessible "Move to" selector on every card.

import { TASK_STATUSES, statusLabel } from '../data/constants.js';
import { createField } from '../components/form.js';
import { memberOptions, priorityOptions, projectOptions, syncSelect } from '../components/options.js';
import { toast } from '../components/toast.js';
import { avatar, button, dueBadge, icon, priorityBadge, projectDot, refreshIcons, tagList } from '../components/ui.js';
import { filterTasks, sortTasks } from '../selectors.js';
import { getState, setTaskStatus } from '../state.js';
import { debounce, dueInfo, h, indexById, todayStr } from '../utils.js';
import { openTaskDetails, openTaskForm } from './tasks.js';

const ui = { query: '', project: 'all', assignee: 'all', priority: 'all' };
let draggedId = null;

function buildCard(task, ctx) {
  const project = ctx.projects.get(task.projectId);
  const assignee = ctx.members.get(task.assigneeId);
  const done = task.status === 'done';
  const moveId = `move-${task.id}`;
  const select = h(
    'select',
    {
      id: moveId,
      class: 'input kanban-move',
      'aria-label': `Move “${task.title}” to another column`,
      dataset: { focusKey: `kanban-move:${task.id}` },
      onchange: (event) => {
        const status = event.target.value;
        if (status === task.status) return;
        const result = setTaskStatus(task.id, status);
        if (result.ok) toast.success(`Moved to ${statusLabel(status)}`);
        else toast.error('Could not move that task.');
      },
    },
    TASK_STATUSES.map((s) => h('option', { value: s.id, selected: s.id === task.status }, s.label)),
  );

  return h(
    'div',
    {
      class: 'kanban-card',
      draggable: 'true',
      dataset: { taskId: task.id },
      ondragstart: (event) => {
        draggedId = task.id;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', task.id);
        const source = event.currentTarget;
        requestAnimationFrame(() => {
          source.classList.add('is-dragging');
          // Form controls inside cards would otherwise swallow drops.
          document.body.dataset.dragging = 'true';
        });
      },
      ondragend: (event) => {
        draggedId = null;
        event.currentTarget.classList.remove('is-dragging');
        delete document.body.dataset.dragging;
        document.querySelectorAll('.kanban-col[data-over]').forEach((col) => col.removeAttribute('data-over'));
      },
    },
    h('div', { class: 'kanban-card-project' }, project ? projectDot(project.color) : null, h('span', {}, project?.name ?? 'Unknown project')),
    // A span with role="button" (not a <button>) so dragging from the title still drags the card in every browser.
    h(
      'span',
      {
        role: 'button',
        tabindex: '0',
        class: `task-title-btn kanban-card-title${done ? ' is-done' : ''}`,
        dataset: { focusKey: `task-open:${task.id}` },
        onclick: () => openTaskDetails(task.id),
        onkeydown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openTaskDetails(task.id);
          }
        },
      },
      task.title,
    ),
    h('div', { class: 'kanban-card-badges' }, priorityBadge(task.priority), task.dueDate ? dueBadge(dueInfo(task.dueDate, done, ctx.today)) : null),
    tagList(task.tags),
    h(
      'div',
      { class: 'kanban-card-footer' },
      h('span', { class: 'kanban-assignee' }, avatar(assignee, { size: 'sm' }), h('span', {}, assignee?.name ?? 'Unassigned')),
      h('label', { class: 'sr-only', for: moveId }, `Move “${task.title}” to`),
      select,
    ),
  );
}

export function createKanbanView() {
  let controls;
  let board;
  let summary;

  function mount(container) {
    controls = {
      query: createField({ name: 'query', label: 'Search', type: 'search', value: ui.query, attrs: { placeholder: 'Search the board', autocomplete: 'off' } }),
      project: createField({ name: 'project', label: 'Project', type: 'select', value: ui.project, options: [] }),
      assignee: createField({ name: 'assignee', label: 'Assignee', type: 'select', value: ui.assignee, options: [] }),
      priority: createField({ name: 'priority', label: 'Priority', type: 'select', value: ui.priority, options: [] }),
    };
    controls.query.el.classList.add('field-grow');
    const apply = () => {
      ui.query = controls.query.getValue();
      ui.project = controls.project.getValue();
      ui.assignee = controls.assignee.getValue();
      ui.priority = controls.priority.getValue();
      render();
    };
    controls.query.input.addEventListener('input', debounce(apply, 120));
    ['project', 'assignee', 'priority'].forEach((key) => controls[key].input.addEventListener('change', apply));

    summary = h('p', { class: 'results-summary', 'aria-live': 'polite' });
    board = h('div', { class: 'kanban' });

    // Drag-and-drop is delegated to the board so re-rendering never stacks listeners.
    board.addEventListener('dragover', (event) => {
      const col = event.target.closest?.('.kanban-col');
      if (!col || !draggedId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.kanban-col[data-over]').forEach((c) => c !== col && c.removeAttribute('data-over'));
      col.dataset.over = 'true';
    });
    board.addEventListener('dragleave', (event) => {
      const col = event.target.closest?.('.kanban-col');
      if (col && !col.contains(event.relatedTarget)) col.removeAttribute('data-over');
    });
    board.addEventListener('drop', (event) => {
      const col = event.target.closest?.('.kanban-col');
      if (!col) return;
      event.preventDefault();
      col.removeAttribute('data-over');
      const id = event.dataTransfer.getData('text/plain') || draggedId;
      draggedId = null;
      const status = col.dataset.status;
      const task = getState().tasks.find((t) => t.id === id);
      if (!task || task.status === status) return;
      const result = setTaskStatus(id, status);
      if (result.ok) toast.success(`Moved “${task.title}” to ${statusLabel(status)}`);
      else toast.error('Could not move that task.');
    });

    container.replaceChildren(
      h(
        'div',
        {},
        h(
          'div',
          { class: 'page-header' },
          h('p', { class: 'page-lede' }, 'Drag cards between columns, or use the “Move to” menu on a card with the keyboard or on touch screens.'),
          h('div', { class: 'page-actions' }, button({ label: 'New task', icon: 'plus', variant: 'primary', onclick: () => openTaskForm() })),
        ),
        h('div', { class: 'toolbar', role: 'group', 'aria-label': 'Filter the board' }, Object.values(controls).map((c) => c.el)),
        summary,
        board,
      ),
    );
  }

  function syncControls() {
    const state = getState();
    syncSelect(controls.project.input, projectOptions(state.projects, { all: 'All active projects' }));
    syncSelect(controls.assignee.input, memberOptions(state.team, { all: 'Everyone', unassigned: { value: 'unassigned', label: 'Unassigned' } }));
    syncSelect(controls.priority.input, priorityOptions({ all: 'All priorities' }));
    for (const key of ['project', 'assignee', 'priority']) {
      const select = controls[key].input;
      select.value = [...select.options].some((o) => o.value === ui[key]) ? ui[key] : 'all';
      ui[key] = select.value;
    }
  }

  function render() {
    const state = getState();
    const today = todayStr();
    const tasks = filterTasks(state, { query: ui.query, project: ui.project, assignee: ui.assignee, priority: ui.priority }, today);
    const ctx = { projects: indexById(state.projects), members: indexById(state.team), today };
    summary.textContent = `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} on the board`;

    board.replaceChildren(
      ...TASK_STATUSES.map((status) => {
        const column = sortTasks(tasks.filter((t) => t.status === status.id), 'priority');
        const headingId = `col-${status.id}`;
        return h(
          'section',
          { class: 'kanban-col', dataset: { status: status.id }, 'aria-labelledby': headingId },
          h(
            'header',
            { class: 'kanban-col-header' },
            h('h2', { class: 'kanban-col-title', id: headingId }, icon(status.icon), status.label, h('span', { class: 'kanban-count', 'aria-label': `${column.length} tasks` }, String(column.length))),
            h('button', { type: 'button', class: 'icon-btn icon-btn-ghost icon-btn-sm', 'aria-label': `Add task to ${status.label}`, title: `Add task to ${status.label}`, onclick: () => openTaskForm(null, { status: status.id }) }, icon('plus')),
          ),
          column.length
            ? h('div', { class: 'kanban-cards' }, column.map((task) => buildCard(task, ctx)))
            : h('div', { class: 'kanban-empty' }, 'No tasks here. Drop a card or add one.'),
        );
      }),
    );
    refreshIcons();
  }

  return {
    mount,
    update() {
      syncControls();
      render();
    },
    unmount() {
      draggedId = null;
    },
  };
}

