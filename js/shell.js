// Application shell behaviours: page title, active navigation, mobile drawer,
// and the persistent storage warning banner.

import { APP_NAME, NAV_ITEMS } from './data/constants.js';

const $ = (selector) => document.querySelector(selector);

export function setPageTitle(title) {
  const heading = $('#page-title');
  if (heading) heading.textContent = title;
  document.title = `${title} · ${APP_NAME}`;
}

export function routeTitle(routeName) {
  return NAV_ITEMS.find((item) => item.id === routeName)?.title ?? APP_NAME;
}

export function setActiveNav(routeName) {
  document.querySelectorAll('.nav-link').forEach((link) => {
    const active = link.dataset.route === routeName;
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

export function setBanner(message) {
  const banner = $('#storage-banner');
  if (!banner) return;
  const text = banner.querySelector('.banner-text');
  banner.hidden = !message;
  if (text) text.textContent = message ?? '';
}

export function initDrawer() {
  const sidebar = $('#sidebar');
  const toggle = $('#menu-toggle');
  const overlay = $('#drawer-overlay');
  if (!sidebar || !toggle || !overlay) return { close() {} };
  const mobile = window.matchMedia('(max-width: 960px)');

  const setOpen = (open, { returnFocus = true } = {}) => {
    sidebar.dataset.open = open ? 'true' : 'false';
    overlay.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('drawer-open', open && mobile.matches);
    if (open) sidebar.querySelector('.nav-link')?.focus();
    else if (returnFocus && mobile.matches) toggle.focus();
  };

  toggle.addEventListener('click', () => setOpen(sidebar.dataset.open !== 'true'));
  overlay.addEventListener('click', () => setOpen(false));
  sidebar.addEventListener('click', (event) => {
    if (event.target.closest('.nav-link') && mobile.matches) setOpen(false, { returnFocus: false });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar.dataset.open === 'true' && mobile.matches) setOpen(false);
  });
  mobile.addEventListener('change', () => setOpen(false, { returnFocus: false }));
  setOpen(false, { returnFocus: false });
  return { close: () => setOpen(false, { returnFocus: false }) };
}
