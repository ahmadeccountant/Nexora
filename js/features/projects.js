// Projects: list with search/filter/sort, detail page, create/edit form,
// archive/restore, and delete (which also deletes the project's tasks).

import { PROJECT_COLORS } from '../data/constants.js';
import { applyErrors, createColorField, createField, readFields } from '../components/form.js';
import { confirmDialog, openModal } from '../components/modal.js';
import { memberOptions, projectStatusOptions } from '../components/options.js';
import { toast } from '../components/toast.js';
import { avatar, button, dueBadge, emptyState, iconButton, notice, priorityBadge, progressBar, projectDot, projectStatusBadge, refreshIcons, statusBadge } from '../components/ui.js';
import { filterProjects, isOverdue, projectProgress, sortProjects } from '../selectors.js';
import { navigate } from '../router.js';
import { setPageTitle } from '../shell.js';
import { addProject, archiveProject, deleteProject, getState, restoreProject, updateProject } from '../state.js';
import { addDays, debounce, dueInfo, formatDate, formatDateTime, formatShortDate, h, indexById, pluralize, todayStr } from '../utils.js';
import { openTaskDetails, openTaskForm, sortTasksForProject } from './tasks.js';

const ui = { query: '', status: 'all', owner: 'all', sort: 'updated' };
const SORT_OPTIONS = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'due', label: 'Due date (soonest)' },
  { value: 'progress', label: 'Progress (highest)' },
  { value: 'status', label: 'Status' },
];

// ---------------------------------------------------------------- dialogs

export function openProjectForm(project = null) {
  const state = getState();
  const today = todayStr();
  const archived = project?.status === 'archived';
  const initial = {
    name: project?.name ?? '',
    description: project?.description ?? '',
    ownerId: project?.ownerId ?? state.team[0]?.id ?? '',
    status: project?.status ?? 'planning',
    startDate: project?.startDate ?? today,
    dueDate: project?.dueDate ?? addDays(today, 30),
    color: project?.color ?? PROJECT_COLORS[state.projects.length % PROJECT_COLORS.length],
  };

  const fields = [
    createField({ name: 'name', label: 'Project name', required: true, value: initial.name, attrs: { maxlength: '80', autocomplete: 'off' } }),
    createField({ name: 'description', label: 'Description', type: 'textarea', value: initial.description, attrs: { maxlength: '500' } }),
    createField({ name: 'ownerId', label: 'Owner', type: 'select', required: true, value: initial.ownerId, options: memberOptions(state.team) }),
    createField({ name: 'startDate', label: 'Start date', type: 'date', required: true, value: initial.startDate }),
    createField({ name: 'dueDate', label: 'Due date', type: 'date', required: true, value: initial.dueDate }),
    createColorField({ name: 'color', label: 'Accent color', colors: PROJECT_COLORS, value: initial.color }),
  ];
  const statusField = archived
    ? null
    : createField({ name: 'status', label: 'Status', type: 'select', value: initial.status, options: projectStatusOptions({ includeArchived: false }) });
  if (statusField) fields.push(statusField);
  const byName = Object.fromEntries(fields.map((f) => [f.name, f.el]));
  const formId = `project-form-${Date.now()}`;
  const formError = h('div', { class: 'form-error-summary', hidden: true });

  const form = h(
    'form',
    { id: formId, novalidate: true },
    formError,
    h(
      'div',
      { class: 'form-grid' },
      h('div', { class: 'full' }, byName.name),
      h('div', { class: 'full' }, byName.description),
      byName.ownerId,
      statusField ? byName.status : h('p', { class: 'field-hint', style: { alignSelf: 'end' } }, 'Archived. Restore the project to change its status.'),
      byName.startDate,
      byName.dueDate,
      h('div', { class: 'full' }, byName.color),
    ),
  );

  let modal;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = readFields(fields);
    if (!statusField) input.status = project.status;
    const result = project ? updateProject(project.id, input) : addProject(input);
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
    toast.success(project ? (result.changed ? 'Project updated' : 'No changes to save') : 'Project created');
  });

  modal = openModal({
    title: project ? 'Edit project' : 'New project',
    closeOnBackdrop: false,
    body: form,
    footer: [
      button({ label: 'Cancel', variant: 'secondary', onclick: () => modal.close() }),
      button({ label: project ? 'Save changes' : 'Create project', variant: 'primary', type: 'submit', attrs: { form: formId } }),
    ],
  });
}

export async function confirmDeleteProject(project) {
  const count = getState().tasks.filter((t) => t.projectId === project.id).length;
  const taskNote = count
    ? `This also permanently deletes its ${pluralize(count, 'task')}.`
    : 'It has no tasks.';
  const confirmed = await confirmDialog({
    title: 'Delete this project?',
    message: `“${project.name}” will be permanently deleted. ${taskNote} This can’t be undone. To keep the work, archive the project instead.`,
    confirmLabel: 'Delete project',
    danger: true,
  });
  if (!confirmed) return false;
  const result = deleteProject(project.id);
  if (result.ok) toast.success(result.removedTasks ? `Project and ${pluralize(result.removedTasks, 'task')} deleted` : 'Project deleted');
  else toast.error('That project was already deleted.');
  return result.ok;
}

export function toggleArchive(project) {
  if (project.status === 'archived') {
    const result = restoreProject(project.id);
    if (result.ok) toast.success(`Restored “${project.name}”`);
  } else {
    const result = archiveProject(project.id);
    if (result.ok) toast.success(`Archived “${project.name}”. Its tasks are hidden from task views until you restore it.`, { duration: 6000 });
  }
}

// ------------------------------------------------------------------- view

function projectActions(project, { afterDelete } = {}) {
  const archived = project.status === 'archived';
  return [
    iconButton({ icon: 'pencil', label: `Edit “${project.name}”`, onclick: () => openProjectForm(project), attrs: { 'data-focus-key': `project-edit:${project.id}` } }),
    iconButton({
      icon: archived ? 'archive-restore' : 'archive',
      label: `${archived ? 'Restore' : 'Archive'} “${project.name}”`,
      onclick: () => toggleArchive(project),
      attrs: { 'data-focus-key': `project-archive:${project.id}` },
    }),
    iconButton({
      icon: 'trash-2',
      label: `Delete “${project.name}”`,
      variant: 'danger',
      onclick: async () => {
        const deleted = await confirmDeleteProject(project);
        if (deleted) afterDelete?.();
      },
    }),
  ];
}

function projectCard(project, state, members) {
  const progress = projectProgress(project.id, state.tasks);
  const owner = members.get(project.ownerId);
  const archived = project.status === 'archived';
  return h(
    'article',
    { class: 'card project-card', dataset: { archived: String(archived) } },
    h('div', { class: 'project-card-bar', style: { background: project.color } }),
    h(
      'div',
      { class: 'project-card-body' },
      h('div', { class: 'project-card-meta' }, projectStatusBadge(project.status), h('span', {}, `Due ${formatShortDate(project.dueDate)}`)),
      h('h3', { class: 'project-card-title' }, h('a', { href: `#/projects/${encodeURIComponent(project.id)}` }, project.name)),
      project.description ? h('p', { class: 'project-card-desc' }, project.description) : h('p', { class: 'project-card-desc' }, 'No description.'),
      h('div', { class: 'row', style: { gap: 'var(--space-2)' } }, avatar(owner, { size: 'sm' }), h('span', { class: 'text-muted', style: { fontSize: 'var(--text-sm)' } }, owner?.name ?? 'No owner')),
      h(
        'div',
        {},
        progressBar(progress.percent, { color: project.color, label: `${project.name} progress` }),
        h('div', { class: 'project-progress-meta', style: { marginTop: 'var(--space-1)' } }, h('span', {}, `${progress.done} of ${pluralize(progress.total, 'task')} done`), h('span', {}, `${progress.percent}%`)),
      ),
    ),
    h(
      'div',
      { class: 'project-card-footer' },
      button({ label: 'Open', variant: 'secondary', onclick: () => navigate(`projects/${project.id}`), attrs: { class: 'btn btn-secondary btn-sm' } }),
      h('div', { class: 'row', style: { gap: 0, flexWrap: 'nowrap' } }, projectActions(project)),
    ),
  );
}

function createListView() {
  let controls;
  let summary;
  let results;

  function mount(container) {
    const state = getState();
    controls = {
      query: createField({ name: 'query', label: 'Search', type: 'search', value: ui.query, attrs: { placeholder: 'Name, description or owner', autocomplete: 'off' } }),
      status: createField({ name: 'status', label: 'Status', type: 'select', value: ui.status, options: projectStatusOptions({ all: 'All statuses' }) }),
      owner: createField({ name: 'owner', label: 'Owner', type: 'select', value: ui.owner, options: memberOptions(state.team, { all: 'Everyone' }) }),
      sort: createField({ name: 'sort', label: 'Sort by', type: 'select', value: ui.sort, options: SORT_OPTIONS }),
    };
    controls.query.el.classList.add('field-grow');
    const apply = () => {
      ui.query = controls.query.getValue();
      ui.status = controls.status.getValue();
      ui.owner = controls.owner.getValue();
      ui.sort = controls.sort.getValue();
      renderResults();
    };
    controls.query.input.addEventListener('input', debounce(apply, 120));
    ['status', 'owner', 'sort'].forEach((key) => controls[key].input.addEventListener('change', apply));

    summary = h('p', { class: 'results-summary', 'aria-live': 'polite' });
    results = h('div');
    container.replaceChildren(
      h(
        'div',
        {},
        h(
          'div',
          { class: 'page-header' },
          h('p', { class: 'page-lede' }, 'Plan and track every project. Progress is calculated from each project’s tasks.'),
          h('div', { class: 'page-actions' }, button({ label: 'New project', icon: 'plus', variant: 'primary', onclick: () => openProjectForm() })),
        ),
        h('div', { class: 'toolbar', role: 'group', 'aria-label': 'Filter and sort projects' }, Object.values(controls).map((c) => c.el)),
        summary,
        results,
      ),
    );
  }

  function renderResults() {
    const state = getState();
    const members = indexById(state.team);
    const list = sortProjects(filterProjects(state.projects, ui, state.team), ui.sort, state.tasks);
    const filtering = ui.query.trim() !== '' || ui.status !== 'all' || ui.owner !== 'all';
    summary.textContent = state.projects.length ? `Showing ${list.length} of ${pluralize(state.projects.length, 'project')}` : '';

    if (!list.length) {
      results.replaceChildren(
        filtering
          ? emptyState({
              iconName: 'search-x',
              title: 'No projects match these filters',
              text: 'Try a different search or show all statuses.',
              actions: [button({ label: 'Clear filters', onclick: () => { Object.assign(ui, { query: '', status: 'all', owner: 'all' }); controls.query.input.value = ''; controls.status.input.value = 'all'; controls.owner.input.value = 'all'; renderResults(); } })],
            })
          : emptyState({
              iconName: 'folder-kanban',
              title: 'No projects yet',
              text: 'Create a project to start organising tasks.',
              actions: [button({ label: 'New project', icon: 'plus', variant: 'primary', onclick: () => openProjectForm() })],
            }),
      );
    } else {
      results.replaceChildren(h('div', { class: 'project-grid' }, list.map((project) => projectCard(project, state, members))));
    }
    refreshIcons();
  }

  function update() {
    const state = getState();
    syncOwnerOptions(state);
    renderResults();
  }

  function syncOwnerOptions(state) {
    const select = controls.owner.input;
    const options = memberOptions(state.team, { all: 'Everyone' });
    if (select.options.length !== options.length || [...select.options].some((o, i) => o.textContent !== options[i].label)) {
      select.replaceChildren(...options.map((o) => Object.assign(document.createElement('option'), { value: o.value, textContent: o.label })));
      select.value = options.some((o) => o.value === ui.owner) ? ui.owner : 'all';
      ui.owner = select.value;
    }
  }

  return { mount, update, unmount() {} };
}

function createDetailView(projectId) {
  let root;

  function mount(container) {
    root = h('div');
    container.replaceChildren(root);
  }

  function update() {
    const state = getState();
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) {
      setPageTitle('Project not found');
      root.replaceChildren(
        emptyState({
          iconName: 'folder-x',
          title: 'Project not found',
          text: 'It may have been deleted. Head back to your projects to pick another.',
          actions: [button({ label: 'Back to projects', variant: 'primary', onclick: () => navigate('projects') })],
        }),
      );
      refreshIcons();
      return;
    }

    setPageTitle(project.name);
    const members = indexById(state.team);
    const owner = members.get(project.ownerId);
    const today = todayStr();
    const tasks = sortTasksForProject(state.tasks.filter((t) => t.projectId === project.id));
    const progress = projectProgress(project.id, state.tasks);
    const inProgress = tasks.filter((t) => t.status === 'in-progress').length;
    const overdue = tasks.filter((t) => isOverdue(t, today)).length;
    const archived = project.status === 'archived';

    root.replaceChildren(
      h('a', { class: 'back-link', href: '#/projects' }, h('i', { 'data-lucide': 'arrow-left', class: 'icon', 'aria-hidden': 'true' }), 'All projects'),
      h(
        'div',
        { class: 'detail-header' },
        h(
          'div',
          { class: 'stack', style: { gap: 'var(--space-2)' } },
          h('div', { class: 'row' }, projectDot(project.color), projectStatusBadge(project.status)),
          h('p', { class: 'page-lede' }, project.description || 'No description.'),
        ),
        h(
          'div',
          { class: 'page-actions' },
          button({ label: 'Add task', icon: 'plus', variant: 'primary', onclick: () => openTaskForm(null, { projectId: project.id }), disabled: archived, attrs: archived ? { title: 'Restore this project to add tasks' } : {} }),
          ...projectActions(project, { afterDelete: () => navigate('projects') }),
        ),
      ),
      archived ? notice('This project is archived. Its tasks are hidden from task views and dashboard metrics until you restore it.', { tone: 'warning', iconName: 'archive' }) : null,
      h(
        'section',
        { class: 'card', style: { marginTop: 'var(--space-4)' } },
        h(
          'dl',
          { class: 'detail-meta' },
          h('div', {}, h('dt', {}, 'Owner'), h('dd', {}, owner ? [avatar(owner, { size: 'sm' }), owner.name] : 'No owner')),
          h('div', {}, h('dt', {}, 'Start date'), h('dd', {}, formatDate(project.startDate))),
          h('div', {}, h('dt', {}, 'Due date'), h('dd', {}, formatDate(project.dueDate), archived || project.status === 'completed' ? null : dueBadge(dueInfo(project.dueDate, false, today)))),
          h('div', {}, h('dt', {}, 'Created'), h('dd', {}, formatDateTime(project.createdAt))),
          h('div', {}, h('dt', {}, 'Last updated'), h('dd', {}, formatDateTime(project.updatedAt))),
        ),
        h(
          'div',
          { style: { marginTop: 'var(--space-5)' } },
          progressBar(progress.percent, { color: project.color, label: `${project.name} progress` }),
          h('div', { class: 'project-progress-meta', style: { marginTop: 'var(--space-1)' } }, h('span', {}, 'Progress is the share of tasks marked Done'), h('span', {}, `${progress.percent}%`)),
        ),
        h(
          'div',
          { class: 'mini-stats' },
          h('div', { class: 'mini-stat' }, h('strong', {}, String(progress.total)), h('span', {}, 'Tasks')),
          h('div', { class: 'mini-stat' }, h('strong', {}, String(progress.done)), h('span', {}, 'Done')),
          h('div', { class: 'mini-stat' }, h('strong', {}, String(inProgress)), h('span', {}, 'In progress')),
          h('div', { class: 'mini-stat' }, h('strong', {}, String(overdue)), h('span', {}, 'Overdue')),
        ),
      ),
      h(
        'section',
        { class: 'card', style: { marginTop: 'var(--space-4)' } },
        h('header', { class: 'card-header' }, h('h2', { class: 'card-title' }, 'Tasks')),
        tasks.length
          ? h(
              'ul',
              { class: 'list' },
              tasks.map((task) => {
                const assignee = members.get(task.assigneeId);
                const done = task.status === 'done';
                return h(
                  'li',
                  {},
                  assignee ? avatar(assignee, { labelled: true, size: 'sm' }) : avatar(null, { labelled: true, size: 'sm' }),
                  h(
                    'div',
                    { class: 'list-main' },
                    h('button', { type: 'button', class: `task-title-btn${done ? ' is-done' : ''}`, onclick: () => openTaskDetails(task.id), dataset: { focusKey: `task-open:${task.id}` } }, task.title),
                    h('div', { class: 'list-meta' }, statusBadge(task.status), priorityBadge(task.priority), task.dueDate ? dueBadge(dueInfo(task.dueDate, done, today)) : null),
                  ),
                );
              }),
            )
          : emptyState({
              iconName: 'square-check-big',
              title: 'No tasks in this project yet',
              text: archived ? 'Restore the project to add tasks.' : 'Add the first task to start tracking progress.',
              actions: archived ? [] : [button({ label: 'Add task', icon: 'plus', variant: 'primary', onclick: () => openTaskForm(null, { projectId: project.id }) })],
            }),
      ),
    );
    refreshIcons();
  }

  return { mount, update, unmount() {} };
}

export function createProjectsView(route) {
  return route.params[0] ? createDetailView(route.params[0]) : createListView();
}
