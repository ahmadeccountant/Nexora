// Nexora entry point: loads data, wires the shell, and renders the current view.

import { CURRENT_USER_ID } from './data/constants.js';
import { buildSeedData } from './data/seed.js';
import { createDropdown, menuItem } from './components/dropdown.js';
import { destroyAllCharts } from './components/charts.js';
import { toast } from './components/toast.js';
import { icon, refreshIcons } from './components/ui.js';
import { createAnalyticsView } from './features/analytics.js';
import { createDashboardView } from './features/dashboard.js';
import { createKanbanView } from './features/kanban.js';
import { initNotifications } from './features/notifications.js';
import { createProjectsView } from './features/projects.js';
import { initGlobalSearch } from './features/search.js';
import { createSettingsView } from './features/settings.js';
import { createTeamView } from './features/team.js';
import { createTasksView, openTaskDetails } from './features/tasks.js';
import { initRouter, navigate } from './router.js';
import { exportJsonBackup } from './services/export.js';
import { initDrawer, routeTitle, setActiveNav, setBanner, setPageTitle } from './shell.js';
import { getState, getStorageState, initState, setTheme, subscribe } from './state.js';
import { isStorageAvailable, loadData, saveData } from './storage.js';
import { h, initials } from './utils.js';

const VIEWS = {
  dashboard: createDashboardView,
  projects: createProjectsView,
  tasks: createTasksView,
  kanban: createKanbanView,
  team: createTeamView,
  analytics: createAnalyticsView,
  settings: createSettingsView,
};

const $ = (selector) => document.querySelector(selector);

let currentView = null;
let currentRoute = null;
let notifications = null;
let renderQueued = false;
let firstRoute = true;

// ---------------------------------------------------------------- startup

function loadInitialData() {
  const loaded = loadData();
  if (loaded.status === 'ok') {
    initState(loaded.data, { storageAvailable: true });
    return;
  }
  const seed = buildSeedData();
  const available = loaded.status !== 'unavailable';
  initState(seed, { storageAvailable: available });
  if (available) saveData(seed); // seed once so refreshes keep the same data
  if (loaded.status === 'corrupt') {
    // Show after the first render so the toast region exists.
    setTimeout(() => toast.error('Saved data couldn’t be read, so demo data was loaded. The unreadable copy was kept in LocalStorage under “nexora.data.corrupt-backup”.', { duration: 10000 }), 300);
  }
}

// ---------------------------------------------------------------- topbar

function applyTheme() {
  const { theme } = getState().preferences;
  document.documentElement.dataset.theme = theme;
  const next = theme === 'dark' ? 'light' : 'dark';
  const button = $('#theme-toggle');
  button.setAttribute('aria-label', `Switch to ${next} theme`);
  button.title = `Switch to ${next} theme`;
  $('#theme-icon').replaceChildren(icon(theme === 'dark' ? 'sun' : 'moon'));
}

function applyProfile() {
  const { preferences, team } = getState();
  const me = team.find((m) => m.id === CURRENT_USER_ID);
  $('#profile-name').textContent = preferences.displayName;
  const avatarEl = $('#profile-avatar');
  avatarEl.textContent = initials(preferences.displayName);
  avatarEl.style.background = me?.color ?? 'var(--color-accent)';
}

function initTopbar() {
  $('#theme-toggle').addEventListener('click', () => setTheme(getState().preferences.theme === 'dark' ? 'light' : 'dark'));

  const profilePanel = $('#profile-panel');
  const profile = createDropdown({
    trigger: $('#profile-button'),
    panel: profilePanel,
    onOpen: () => {
      const { preferences } = getState();
      profilePanel.dataset.focusFirst = 'true';
      profilePanel.replaceChildren(
        h('div', { class: 'menu-header' }, h('strong', {}, preferences.displayName), h('span', {}, 'Demo workspace')),
        menuItem({ label: 'Settings', icon: icon('settings'), onclick: () => { profile.close(); navigate('settings'); } }),
        menuItem({
          label: preferences.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
          icon: icon(preferences.theme === 'dark' ? 'sun' : 'moon'),
          onclick: () => { profile.close(); setTheme(preferences.theme === 'dark' ? 'light' : 'dark'); },
        }),
        menuItem({
          label: 'Download JSON backup',
          icon: icon('download'),
          onclick: () => {
            profile.close();
            const result = exportJsonBackup(getState());
            if (result.ok) toast.success(`Backup downloaded as ${result.filename}`);
            else toast.error(`Couldn’t download the backup: ${result.error}`);
          },
        }),
      );
      refreshIcons();
    },
  });

  initGlobalSearch({ input: $('#global-search'), panel: $('#search-results') });
  notifications = initNotifications({ trigger: $('#notifications-button'), badge: $('#notifications-count'), panel: $('#notifications-panel') });
}

function applyStorageBanner() {
  const storage = getStorageState();
  if (!storage.available) setBanner('Browser storage is unavailable, so your changes will be lost when you close this tab. Use Settings to download a backup.');
  else if (storage.error) setBanner('Your latest changes couldn’t be saved to this browser. Download a JSON backup from Settings to keep your work.');
  else setBanner(null);
}

// --------------------------------------------------------------- routing

function onRoute(route) {
  currentView?.unmount();
  destroyAllCharts();
  currentRoute = route;

  const main = $('#main');
  setActiveNav(route.name);
  setPageTitle(routeTitle(route.name));
  currentView = VIEWS[route.name](route);
  currentView.mount(main, route);
  currentView.update();
  refreshIcons();

  if (!firstRoute) {
    window.scrollTo(0, 0);
    if (!document.querySelector('dialog[open]')) main.focus({ preventScroll: true });
  }
  firstRoute = false;

  if (route.name === 'tasks' && route.params[0]) openTaskDetails(route.params[0]);
}

// ------------------------------------------------------------ re-rendering

/** Re-render once per frame after state changes, keeping keyboard focus where it was. */
function onStateChange() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    const active = document.activeElement;
    const focusKey = active instanceof HTMLElement ? active.dataset.focusKey : null;

    applyTheme();
    applyProfile();
    applyStorageBanner();
    currentView?.update();
    notifications?.refresh();
    refreshIcons();

    if (focusKey && !document.contains(active)) {
      const next = document.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`);
      if (next instanceof HTMLElement) next.focus();
    }
  });
}

function init() {
  loadInitialData();
  applyTheme();
  applyProfile();
  initDrawer();
  initTopbar();
  applyStorageBanner();
  notifications.refresh();
  subscribe(onStateChange);
  initRouter(onRoute);
  refreshIcons();

  // Keep relative times, "today" and deadline notices current without user input.
  setInterval(() => {
    if (document.hidden) return;
    notifications.refresh();
    if (currentRoute?.name === 'dashboard' && !document.querySelector('dialog[open]')) currentView?.update();
  }, 60000);

  // Icons may arrive after the module runs (deferred CDN script); redraw once everything has loaded.
  window.addEventListener('load', () => {
    applyTheme();
    refreshIcons();
    currentView?.update();
  });
}

window.addEventListener('unhandledrejection', (event) => console.error('Nexora: unhandled promise rejection', event.reason));

if (!isStorageAvailable()) console.warn('Nexora: LocalStorage is unavailable; running in memory only.');
init();
