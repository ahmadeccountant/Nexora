// My Tasks view plus the shared task dialogs (create/edit, details, delete)
// that the dashboard, projects and Kanban views also use.

import { CURRENT_USER_ID } from '../data/constants.js';
import { applyErrors, createField, readFields } from '../components/form.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { memberOptions, priorityOptions, projectOptions, statusOptions, syncSelect } from '../components/options.js';
import { toast } from '../components/toast.js';
import { avatar, button, dueBadge, emptyState, iconButton, notice, priorityBadge, projectDot, refreshIcons, statusBadge, tagList } from '../components/ui.js';
import { filterTasks, sortTasks } from '../selectors.js';
import { navigate, parseHash, replacePath } from '../router.js';
import { addTask, deleteTask, getState, setTaskStatus, subscribe, updateTask } from '../state.js';
import { debounce, dueInfo, formatDate, formatDateTime, h, indexById, pluralize, todayStr } from '../utils.js';

const DEFAULT_FILTERS = { query: '', project: 'all', status: 'all', priority: 'all', assignee: 'all' };
const SORT_OPTIONS = [
  { value: 'due', label: 'Due date (soonest)' },
  { value: 'priority', label: 'Priority (highest)' },
  { value: 'title', label: 'Title (A–Z)' },
  { value: 'status', label: 'Status (workflow order)' },
];
const OVERDUE_OPTION = { value: 'overdue', label: 'Overdue' };
const OPEN_OPTION = { value: 'open', label: 'Open (not done)' };

const ui = { filters: { ...DEFAULT_FILTERS }, sort: 'due', initialised: false };

/** Preset filters from elsewhere (dashboard cards, team page). */
export function setTaskFilters(partial = {}) {
  ui.filters = { ...DEFAULT_FILTERS, ...partial };
  ui.initialised = true;
}

// ---------------------------------------------------------------- dialogs

export function openTaskForm(task = null, defaults = {}) {
  const state = getState();
  const selectable = state.projects.filter((p) => p.status !== 'archived' || p.id === task?.projectId);
  if (!selectable.length) {
    toast.info('Create a project first — every task belongs to a project.');
    navigate('projects');
    return;
  }

  const initial = {
    title: task?.title ?? '',
    description: task?.description ?? '',
    projectId: task?.projectId ?? defaults.projectId ?? selectable[0].id,
    assigneeId: task?.assigneeId ?? defaults.assigneeId ?? '',
    status: task?.status ?? defaults.status ?? 'todo',
    priority: task?.priority ?? 'medium',
    dueDate: task?.dueDate ?? '',
    tags: (task?.tags ?? []).join(', '),
  };

  const fields = [
    createField({ name: 'title', label: 'Title', required: true, value: initial.title, attrs: { maxlength: '120', autocomplete: 'off' } }),
    createField({ name: 'description', label: 'Description', type: 'textarea', value: initial.description, attrs: { maxlength: '1000' } }),
    createField({ name: 'projectId', label: 'Project', type: 'select', required: true, value: initial.projectId, options: projectOptions(selectable) }),
    createField({
      name: 'assigneeId',
      label: 'Assignee',
      type: 'select',
      value: initial.assigneeId,
      options: memberOptions(state.team, { unassigned: { value: '', label: 'Unassigned' } }),
    }),
    createField({ name: 'status', label: 'Status', type: 'select', value: initial.status, options: statusOptions() }),
    createField({ name: 'priority', label: 'Priority', type: 'select', value: initial.priority, options: priorityOptions() }),
    createField({ name: 'dueDate', label: 'Due date', type: 'date', value: initial.dueDate }),
    createField({ name: 'tags', label: 'Tags', value: initial.tags, hint: 'Separate with commas, up to 8 tags.', attrs: { autocomplete: 'off' } }),
  ];
  const byName = Object.fromEntries(fields.map((f) => [f.name, f.el]));
  const formError = h('div', { class: 'form-error-summary', hidden: true });
  const formId = `task-form-${Date.now()}`;

  const form = h(
    'form',
    { id: formId, novalidate: true },
    formError,
    h(
      'div',
      { class: 'form-grid' },
      h('div', { class: 'full' }, byName.title),
      h('div', { class: 'full' }, byName.description),
      byName.projectId,
      byName.assigneeId,
      byName.status,
      byName.priority,
      byName.dueDate,
      byName.tags,
    ),
  );

  let modal;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = readFields(fields);
    const result = task ? updateTask(task.id, input) : addTask(input);
    if (!result.ok) {
      formError.replaceChildren();
      formError.hidden = !result.errors._form;
      if (result.errors._form) {
        formError.append(notice(result.errors._form, { tone: 'danger', iconName: 'triangle-alert' }));
        refreshIcons();
      }
      applyErrors(fields, result.errors);
      return;
    }
    modal.close(result.item);
    toast.success(task ? (result.changed ? 'Task updated' : 'No changes to save') : 'Task created');
  });

  modal = openModal({
    title: task ? 'Edit task' : 'New task',
    size: 'md',
    closeOnBackdrop: false,
    body: form,
    footer: [
      button({ label: 'Cancel', variant: 'secondary', onclick: () => modal.close() }),
      button({ label: task ? 'Save changes' : 'Create task', variant: 'primary', type: 'submit', attrs: { form: formId } }),
    ],
  });
}

export async function confirmDeleteTask(task) {
  const confirmed = await confirmDialog({
    title: 'Delete this task?',
    message: `“${task.title}” will be permanently deleted. This can’t be undone.`,
    confirmLabel: 'Delete task',
    danger: true,
  });
  if (!confirmed) return false;
  const result = deleteTask(task.id);
  if (result.ok) toast.success('Task deleted');
  else toast.error('That task was already deleted.');
  return result.ok;
}

export function openTaskDetails(taskId) {
  if (!getState().tasks.some((t) => t.id === taskId)) {
    toast.error('That task no longer exists.');
    return;
  }
  const body = h('div');
  let modal;
  let unsubscribe = () => {};

  const render = () => {
    const state = getState();
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) {
      modal?.close();
      return;
    }
    const project = state.projects.find((p) => p.id === task.projectId);
    const assignee = state.team.find((m) => m.id === task.assigneeId);
    const due = dueInfo(task.dueDate, task.status === 'done');
    const hadSelectFocus = body.contains(document.activeElement) && document.activeElement.tagName === 'SELECT';
    const statusField = createField({ name: 'status', label: 'Move to', type: 'select', value: task.status, options: statusOptions() });
    statusField.input.addEventListener('change', () => {
      const result = setTaskStatus(task.id, statusField.getValue());
      if (!result.ok) toast.error('Could not change the status.');
    });

    body.replaceChildren(
      h('div', { class: 'row' }, statusBadge(task.status), priorityBadge(task.priority), task.dueDate ? dueBadge(due) : null),
      task.description ? h('p', { class: 'task-detail-desc' }, task.description) : h('p', { class: 'task-detail-desc' }, 'No description.'),
      h(
        'dl',
        { class: 'task-detail-grid' },
        h('div', {}, h('dt', {}, 'Project'), h('dd', {}, project ? [projectDot(project.color), project.name] : 'Unknown project')),
        h('div', {}, h('dt', {}, 'Assignee'), h('dd', {}, assignee ? [avatar(assignee, { size: 'sm' }), assignee.name] : 'Unassigned')),
        h('div', {}, h('dt', {}, 'Due date'), h('dd', {}, task.dueDate ? formatDate(task.dueDate) : 'No due date')),
        h('div', {}, h('dt', {}, 'Tags'), h('dd', {}, task.tags.length ? tagList(task.tags) : 'None')),
        h('div', {}, h('dt', {}, 'Created'), h('dd', {}, formatDateTime(task.createdAt))),
        h('div', {}, h('dt', {}, task.completedAt ? 'Completed' : 'Last updated'), h('dd', {}, formatDateTime(task.completedAt ?? task.updatedAt))),
      ),
      h('div', { style: { marginTop: 'var(--space-4)', maxWidth: '14rem' } }, statusField.el),
    );
    refreshIcons();
    if (hadSelectFocus) statusField.input.focus();
  };

  const footer = [
    button({ label: 'Delete', icon: 'trash-2', variant: 'secondary', onclick: () => { const t = getState().tasks.find((x) => x.id === taskId); if (t) confirmDeleteTask(t); } }),
    button({ label: 'Edit task', icon: 'pencil', variant: 'primary', onclick: () => { const t = getState().tasks.find((x) => x.id === taskId); if (t) openTaskForm(t); } }),
  ];

  const task = getState().tasks.find((t) => t.id === taskId);
  modal = openModal({
    title: task.title,
    size: 'md',
    body,
    footer,
    onClose: () => {
      unsubscribe();
      const route = parseHash();
      if (route.name === 'tasks' && route.params[0] === taskId) replacePath('tasks');
    },
  });
  render();
  unsubscribe = subscribe(() => {
    const state = getState();
    const current = state.tasks.find((t) => t.id === taskId);
    if (current) {
      modal.dialog.querySelector('.modal-title').textContent = current.title;
    }
    render();
  });
}

// ------------------------------------------------------------------- view

function buildRow(task, ctx) {
  const project = ctx.projects.get(task.projectId);
  const assignee = ctx.members.get(task.assigneeId);
  const done = task.status === 'done';
  const due = dueInfo(task.dueDate, done, ctx.today);

  const check = h('input', {
    type: 'checkbox',
    class: 'check',
    checked: done,
    'aria-label': done ? `Mark “${task.title}” as not done` : `Mark “${task.title}” as done`,
    dataset: { focusKey: `task-check:${task.id}` },
    onchange: (event) => {
      const result = setTaskStatus(task.id, event.target.checked ? 'done' : 'todo');
      if (result.ok) toast.success(event.target.checked ? 'Task completed' : 'Task reopened');
    },
  });

  return h(
    'tr',
    { dataset: { taskId: task.id } },
    h('td', { class: 'cell-check' }, check),
    h(
      'td',
      { class: 'cell-title' },
      h('button', { type: 'button', class: `task-title-btn${done ? ' is-done' : ''}`, onclick: () => openTaskDetails(task.id), dataset: { focusKey: `task-open:${task.id}` } }, task.title),
      task.tags.length ? h('div', { style: { marginTop: 'var(--space-1)' } }, tagList(task.tags)) : null,
    ),
    h('td', { 'data-label': 'Project' }, project ? h('span', { class: 'row', style: { gap: 'var(--space-2)', flexWrap: 'nowrap' } }, projectDot(project.color), project.name) : '—'),
    h('td', { 'data-label': 'Priority' }, priorityBadge(task.priority)),
    h('td', { 'data-label': 'Status' }, statusBadge(task.status)),
    h('td', { 'data-label': 'Assignee' }, assignee ? h('span', { class: 'row', style: { gap: 'var(--space-2)', flexWrap: 'nowrap' } }, avatar(assignee, { size: 'sm' }), assignee.name) : h('span', { class: 'text-muted' }, 'Unassigned')),
    h('td', { 'data-label': 'Due' }, task.dueDate ? dueBadge(due) : h('span', { class: 'text-muted' }, 'No due date')),
    h(
      'td',
      { class: 'cell-actions-wrap' },
      h(
        'div',
        { class: 'cell-actions' },
        iconButton({ icon: 'pencil', label: `Edit “${task.title}”`, onclick: () => openTaskForm(task), attrs: { 'data-focus-key': `task-edit:${task.id}` } }),
        iconButton({ icon: 'trash-2', label: `Delete “${task.title}”`, variant: 'danger', onclick: () => confirmDeleteTask(task) }),
      ),
    ),
  );
}

export function createTasksView() {
  let root;
  let controls;
  let summary;
  let results;

  function mount(container) {
    const state = getState();
    if (!ui.initialised) {
      ui.filters = { ...DEFAULT_FILTERS, assignee: state.preferences.defaultTaskView === 'mine' ? CURRENT_USER_ID : 'all' };
      ui.initialised = true;
    }

    controls = {
      query: createField({ name: 'query', label: 'Search', type: 'search', value: ui.filters.query, attrs: { placeholder: 'Title, tag, project or person', autocomplete: 'off' } }),
      project: createField({ name: 'project', label: 'Project', type: 'select', value: ui.filters.project, options: [] }),
      status: createField({ name: 'status', label: 'Status', type: 'select', value: ui.filters.status, options: [] }),
      priority: createField({ name: 'priority', label: 'Priority', type: 'select', value: ui.filters.priority, options: [] }),
      assignee: createField({ name: 'assignee', label: 'Assignee', type: 'select', value: ui.filters.assignee, options: [] }),
      sort: createField({ name: 'sort', label: 'Sort by', type: 'select', value: ui.sort, options: SORT_OPTIONS }),
    };
    controls.query.el.classList.add('field-grow');

    const apply = () => {
      ui.filters = {
        query: controls.query.getValue(),
        project: controls.project.getValue(),
        status: controls.status.getValue(),
        priority: controls.priority.getValue(),
        assignee: controls.assignee.getValue(),
      };
      ui.sort = controls.sort.getValue();
      renderResults();
    };
    const applyDebounced = debounce(apply, 120);
    controls.query.input.addEventListener('input', applyDebounced);
    Object.values(controls).filter((c) => c.name !== 'query').forEach((c) => c.input.addEventListener('change', apply));

    const clearButton = button({
      label: 'Clear filters',
      icon: 'x',
      variant: 'ghost',
      onclick: () => {
        ui.filters = { ...DEFAULT_FILTERS };
        syncControls();
        renderResults();
      },
    });

    summary = h('p', { class: 'results-summary', 'aria-live': 'polite' });
    results = h('div');
    root = h(
      'div',
      {},
      h(
        'div',
        { class: 'page-header' },
        h('p', { class: 'page-lede' }, 'Every task across your active projects. Filter by person, status or priority, then open a task to see details.'),
        h('div', { class: 'page-actions' }, button({ label: 'New task', icon: 'plus', variant: 'primary', onclick: () => openTaskForm() })),
      ),
      h('div', { class: 'toolbar', role: 'group', 'aria-label': 'Filter and sort tasks' }, Object.values(controls).map((c) => c.el), h('div', { class: 'toolbar-end' }, clearButton)),
      summary,
      results,
    );
    container.replaceChildren(root);
  }

  function syncControls() {
    const state = getState();
    const changed = [
      syncSelect(controls.project.input, projectOptions(state.projects, { all: 'All active projects' })),
      syncSelect(controls.status.input, statusOptions({ all: 'All statuses', extra: [OPEN_OPTION, OVERDUE_OPTION] })),
      syncSelect(controls.priority.input, priorityOptions({ all: 'All priorities' })),
      syncSelect(controls.assignee.input, memberOptions(state.team, { all: 'Everyone', unassigned: { value: 'unassigned', label: 'Unassigned' } })),
    ];
    // Apply the stored filters (e.g. preset from another page) once options exist.
    if (document.activeElement !== controls.query.input) controls.query.input.value = ui.filters.query;
    for (const key of ['project', 'status', 'priority', 'assignee']) {
      const select = controls[key].input;
      if ([...select.options].some((o) => o.value === ui.filters[key])) select.value = ui.filters[key];
      else select.value = 'all';
    }
    controls.sort.input.value = ui.sort;
    if (changed.some(Boolean)) {
      ui.filters = {
        query: controls.query.getValue(),
        project: controls.project.getValue(),
        status: controls.status.getValue(),
        priority: controls.priority.getValue(),
        assignee: controls.assignee.getValue(),
      };
    }
  }

  function renderResults() {
    const state = getState();
    const today = todayStr();
    const filtered = sortTasks(filterTasks(state, ui.filters, today), ui.sort);
    const visibleTotal = filterTasks(state, DEFAULT_FILTERS, today).length;
    const filtering = JSON.stringify(ui.filters) !== JSON.stringify(DEFAULT_FILTERS);

    summary.textContent = visibleTotal ? `Showing ${filtered.length} of ${pluralize(visibleTotal, 'task')}` : '';

    if (!filtered.length) {
      results.replaceChildren(
        filtering
          ? emptyState({
              iconName: 'search-x',
              title: 'No tasks match these filters',
              text: 'Try a different search or clear the filters to see everything.',
              actions: [button({ label: 'Clear filters', variant: 'secondary', onclick: () => { ui.filters = { ...DEFAULT_FILTERS }; syncControls(); renderResults(); } })],
            })
          : emptyState({
              iconName: 'square-check-big',
              title: 'No tasks yet',
              text: 'Create your first task to start tracking work.',
              actions: [button({ label: 'New task', icon: 'plus', variant: 'primary', onclick: () => openTaskForm() })],
            }),
      );
      refreshIcons();
      return;
    }

    const ctx = { projects: indexById(state.projects), members: indexById(state.team), today };
    results.replaceChildren(
      h(
        'div',
        { class: 'table-wrap' },
        h(
          'table',
          { class: 'data-table' },
          h('caption', { class: 'sr-only' }, 'Tasks'),
          h(
            'thead',
            {},
            h('tr', {}, h('th', { scope: 'col', style: { width: '2.5rem' } }, h('span', { class: 'sr-only' }, 'Done')), ['Task', 'Project', 'Priority', 'Status', 'Assignee', 'Due'].map((label) => h('th', { scope: 'col' }, label)), h('th', { scope: 'col' }, h('span', { class: 'sr-only' }, 'Actions'))),
          ),
          h('tbody', {}, filtered.map((task) => buildRow(task, ctx))),
        ),
      ),
    );
    refreshIcons();
  }

  function update() {
    syncControls();
    renderResults();
  }

  function unmount() {
    root = null;
  }

  return { mount, update, unmount };
}


/** Project detail ordering: workflow status first, then due date. */
export const sortTasksForProject = (tasks) => sortTasks(tasks, 'status');
