// Minimal hash router: "#/projects" or "#/projects/project_001".
// Hash routing keeps the app deployable on any static host (GitHub Pages, Netlify)
// and gives working back/forward buttons without server configuration.

import { NAV_ITEMS } from './data/constants.js';

const ROUTE_NAMES = new Set(NAV_ITEMS.map((item) => item.id));
let handler = null;

export function parseHash(hash = window.location.hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [name = 'dashboard', ...params] = parts;
  return { name: ROUTE_NAMES.has(name) ? name : null, params };
}

export function navigate(path) {
  const target = `#/${path}`;
  if (window.location.hash === target) {
    run();
    return;
  }
  window.location.hash = target;
}

/** Update the URL without triggering a route change (used when closing detail modals). */
export function replacePath(path) {
  window.history.replaceState(null, '', `#/${path}`);
}

function run() {
  const route = parseHash();
  if (!route.name) {
    window.history.replaceState(null, '', '#/dashboard');
    handler?.({ name: 'dashboard', params: [] });
    return;
  }
  handler?.(route);
}

export function initRouter(onRoute) {
  handler = onRoute;
  window.addEventListener('hashchange', run);
  run();
}
