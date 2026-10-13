// Settings: appearance, profile, defaults, data export/restore/reset, storage status.

import { TAGLINE } from '../data/constants.js';
import { createField } from '../components/form.js';
import { confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { button, icon, refreshIcons, section } from '../components/ui.js';
import { exportJsonBackup, exportProjectsCsv, exportTasksCsv } from '../services/export.js';
import { parseBackup, savedDataSize } from '../storage.js';
import { getState, getStorageState, replaceAllData, resetToSeed, setDefaultTaskView, setDisplayName, setTheme } from '../state.js';
import { h, pluralize } from '../utils.js';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

function radioGroup(name, legend, options, onChange) {
  const inputs = options.map((o) => h('input', { type: 'radio', name, id: `${name}-${o.value}`, value: o.value, onchange: () => onChange(o.value) }));
  const el = h(
    'div',
    { class: 'segmented', role: 'radiogroup', 'aria-label': legend },
    options.map((o, i) => [inputs[i], h('label', { for: `${name}-${o.value}` }, o.icon ? icon(o.icon) : null, o.label)]),
  );
  return { el, set: (value) => inputs.forEach((input) => { input.checked = input.value === value; }) };
}

function row(title, description, ...controls) {
  return h('div', { class: 'setting-row' }, h('div', { class: 'setting-copy' }, h('strong', {}, title), h('span', {}, description)), ...controls);
}

export function createSettingsView() {
  let themeGroup;
  let viewGroup;
  let nameField;
  let storageInfo;
  let importErrors;
  let fileInput;

  function mount(container) {
    themeGroup = radioGroup('theme', 'Theme', [{ value: 'light', label: 'Light', icon: 'sun' }, { value: 'dark', label: 'Dark', icon: 'moon' }], (value) => setTheme(value));
    viewGroup = radioGroup('task-view', 'My Tasks opens with', [{ value: 'all', label: 'All tasks' }, { value: 'mine', label: 'Assigned to me' }], (value) => {
      setDefaultTaskView(value);
      toast.success('Default task view saved');
    });

    nameField = createField({ name: 'displayName', label: 'Display name', value: getState().preferences.displayName, attrs: { maxlength: '40', autocomplete: 'off' } });
    const nameForm = h(
      'form',
      { class: 'inline-form', novalidate: true, onsubmit: (event) => {
        event.preventDefault();
        const result = setDisplayName(nameField.getValue());
        if (!result.ok) {
          nameField.setError(result.error);
          nameField.input.focus();
          return;
        }
        toast.success(result.changed ? 'Display name saved' : 'No changes to save');
      } },
      nameField.el,
      h('div', { style: { alignSelf: 'flex-end' } }, button({ label: 'Save name', variant: 'secondary', type: 'submit' })),
    );

    storageInfo = h('p', { class: 'notice notice-info', role: 'status' });
    importErrors = h('div', { class: 'import-errors', hidden: true });
    fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'restore-file', tabindex: '-1', onchange: handleFile });

    const exportAction = (fn, label) => () => {
      const result = fn(getState());
      if (result.ok) toast.success(`${label} downloaded as ${result.filename}`);
      else toast.error(`Couldn’t download ${label.toLowerCase()}: ${result.error}`);
    };

    container.replaceChildren(
      h(
        'div',
        { class: 'settings-stack' },
        h('p', { class: 'page-lede' }, `${TAGLINE} Nexora is a frontend demo: your changes live in this browser only.`),
        section('Appearance', {}, row('Theme', 'Choose a light or deep-navy dark interface. Your choice is remembered.', themeGroup.el)),
        section(
          'Profile and defaults',
          {},
          row('Display name', 'Shown in the greeting and profile menu. It also renames you on the Team page.', nameForm),
          row('My Tasks opens with', 'Choose which tasks you see the first time you open My Tasks in a session.', viewGroup.el),
        ),
        section(
          'Data',
          { description: 'Export your work or move it between browsers.' },
          row('Export projects (CSV)', 'One row per project, with owner, dates and progress.', button({ label: 'Export projects', icon: 'download', onclick: exportAction(exportProjectsCsv, 'Projects CSV') })),
          row('Export tasks (CSV)', 'One row per task, with project, assignee, priority and dates.', button({ label: 'Export tasks', icon: 'download', onclick: exportAction(exportTasksCsv, 'Tasks CSV') })),
          row('Full backup (JSON)', 'Everything: projects, tasks, team, activity and preferences.', button({ label: 'Download backup', icon: 'download', onclick: exportAction(exportJsonBackup, 'Backup') })),
          h(
            'div',
            { class: 'setting-row' },
            h('div', { class: 'setting-copy' }, h('strong', {}, 'Restore from backup'), h('span', {}, 'Choose a Nexora JSON backup. It is checked before anything is replaced, and your current data stays untouched if the file is invalid.')),
            h('div', { class: 'setting-actions' }, fileInput, button({ label: 'Restore from JSON', icon: 'upload', onclick: () => fileInput.click() })),
          ),
          importErrors,
          row('Reset to demo data', 'Replace all projects, tasks, team and activity with fresh demo data.', button({ label: 'Reset demo data', icon: 'rotate-ccw', variant: 'danger', onclick: handleReset })),
        ),
        section('Storage', { description: 'Where your data lives' }, storageInfo),
      ),
    );
  }

  async function handleReset() {
    const confirmed = await confirmDialog({
      title: 'Reset to demo data?',
      message: 'All current projects, tasks and activity will be replaced with fresh demo data. Download a backup first if you want to keep your work.',
      confirmLabel: 'Reset demo data',
      danger: true,
    });
    if (!confirmed) return;
    resetToSeed();
    importErrors.hidden = true;
    toast.success('Demo data restored');
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    importErrors.replaceChildren();
    importErrors.hidden = true;

    const fail = (messages) => {
      importErrors.hidden = false;
      importErrors.append(
        h('div', { class: 'notice notice-danger', role: 'alert' }, icon('triangle-alert'), h('div', {}, h('strong', {}, 'Restore failed. Your current data was not changed.'), h('ul', {}, messages.map((m) => h('li', {}, m))))),
      );
      refreshIcons();
      toast.error('That backup couldn’t be restored. Your current data is unchanged.');
    };

    if (file.size > MAX_IMPORT_BYTES) return fail(['The file is larger than 5 MB.']);
    let text;
    try {
      text = await file.text();
    } catch {
      return fail(['The file couldn’t be read.']);
    }
    const result = parseBackup(text);
    if (!result.ok) return fail(result.errors);

    const { projects, tasks, team } = result.data;
    const confirmed = await confirmDialog({
      title: 'Replace current data?',
      message: `This backup has ${pluralize(projects.length, 'project')}, ${pluralize(tasks.length, 'task')} and ${pluralize(team.length, 'team member')}. Restoring replaces everything you have now.`,
      confirmLabel: 'Restore backup',
      danger: true,
    });
    if (!confirmed) return;
    replaceAllData(result.data);
    toast.success('Backup restored');
  }

  function update() {
    const state = getState();
    themeGroup.set(state.preferences.theme);
    viewGroup.set(state.preferences.defaultTaskView);
    if (document.activeElement !== nameField.input) nameField.input.value = state.preferences.displayName;

    const storage = getStorageState();
    const kb = (savedDataSize() / 1024).toFixed(1);
    storageInfo.replaceChildren(
      icon(storage.available && !storage.error ? 'info' : 'triangle-alert'),
      h(
        'span',
        {},
        !storage.available
          ? 'LocalStorage isn’t available in this browser session, so changes are kept in memory only and will be lost when you close the tab.'
          : storage.error
            ? `Your latest changes couldn’t be saved (${storage.error}). Download a JSON backup so you don’t lose them.`
            : `Data is saved in this browser’s LocalStorage (about ${kb} KB). It isn’t encrypted, isn’t shared between devices, and clearing site data removes it.`,
      ),
    );
    refreshIcons();
  }

  return { mount, update, unmount() {} };
}

