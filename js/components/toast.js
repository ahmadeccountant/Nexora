// Toast notifications. The container is a popover when supported so toasts
// stay visible above open modal dialogs (which live in the browser top layer).

import { h } from '../utils.js';
import { icon, refreshIcons } from './ui.js';

let container = null;
const ICONS = { success: 'circle-check', error: 'triangle-alert', info: 'info' };

function ensureContainer() {
  if (container && document.body.contains(container)) return container;
  container = h('div', { class: 'toast-region', role: 'region', 'aria-label': 'Notifications', 'aria-live': 'polite' });
  if ('popover' in HTMLElement.prototype) container.setAttribute('popover', 'manual');
  document.body.append(container);
  return container;
}

function lift(region) {
  // Re-showing the popover moves it above any dialog opened since.
  if (!('showPopover' in region)) return;
  try {
    if (region.matches(':popover-open')) region.hidePopover();
    region.showPopover();
  } catch {
    /* popover unsupported or already in desired state */
  }
}

export function showToast(message, type = 'info', { duration } = {}) {
  const region = ensureContainer();
  const remove = () => {
    toastEl.remove();
    if (!region.children.length && 'hidePopover' in region) {
      try {
        if (region.matches(':popover-open')) region.hidePopover();
      } catch {
        /* ignore */
      }
    }
  };
  const dismiss = h('button', { type: 'button', class: 'icon-btn icon-btn-ghost', 'aria-label': 'Dismiss notification', onclick: remove }, icon('x'));
  const toastEl = h(
    'div',
    { class: `toast toast-${type}`, role: type === 'error' ? 'alert' : 'status' },
    icon(ICONS[type] ?? ICONS.info),
    h('p', { class: 'toast-message' }, message),
    dismiss,
  );
  region.append(toastEl);
  lift(region);
  refreshIcons();
  const ms = duration ?? (type === 'error' ? 7000 : 4000);
  setTimeout(remove, ms);
}

export const toast = {
  success: (message, options) => showToast(message, 'success', options),
  error: (message, options) => showToast(message, 'error', options),
  info: (message, options) => showToast(message, 'info', options),
};
