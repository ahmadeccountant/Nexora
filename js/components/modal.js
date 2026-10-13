// Accessible modal dialogs using the native <dialog> element, which provides
// a focus trap, Escape-to-close and an inert background. We add a visible
// close button, focus restoration and body scroll locking.

import { h } from '../utils.js';
import { button, icon, refreshIcons } from './ui.js';

let openCount = 0;
let titleCounter = 0;

/**
 * Open a modal.
 * @param {object} options
 * @param {string} options.title Dialog heading (also its accessible name).
 * @param {Node|Node[]} options.body Dialog content.
 * @param {Node|Node[]} [options.footer] Footer actions.
 * @param {'sm'|'md'|'lg'} [options.size]
 * @param {boolean} [options.closeOnBackdrop] Click outside to close.
 * @param {(result:any)=>void} [options.onClose]
 * @returns {{ dialog: HTMLDialogElement, close: (result?:any)=>void }}
 */
export function openModal({ title, body, footer = null, size = 'md', closeOnBackdrop = true, onClose = null }) {
  titleCounter += 1;
  const titleId = `modal-title-${titleCounter}`;
  const returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let result;

  const closeButton = h('button', { type: 'button', class: 'icon-btn icon-btn-ghost', 'aria-label': 'Close dialog', title: 'Close' }, icon('x'));
  const dialog = h(
    'dialog',
    { class: `modal modal-${size}`, 'aria-labelledby': titleId },
    h(
      'div',
      { class: 'modal-panel' },
      h('header', { class: 'modal-header' }, h('h2', { id: titleId, class: 'modal-title' }, title), closeButton),
      h('div', { class: 'modal-body' }, body),
      footer ? h('footer', { class: 'modal-footer' }, footer) : null,
    ),
  );

  const close = (value) => {
    result = value;
    if (dialog.open) dialog.close();
  };

  closeButton.addEventListener('click', () => close());
  if (closeOnBackdrop) {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) close();
    });
  }
  dialog.addEventListener('close', () => {
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) document.body.classList.remove('modal-open');
    dialog.remove();
    if (returnFocusTo && document.contains(returnFocusTo)) returnFocusTo.focus();
    if (onClose) onClose(result);
  });

  document.body.append(dialog);
  openCount += 1;
  document.body.classList.add('modal-open');
  dialog.showModal();
  refreshIcons();

  // Prefer the first form control over the close button.
  const first = dialog.querySelector('[data-autofocus], .modal-body input:not([type="hidden"]), .modal-body select, .modal-body textarea');
  if (first instanceof HTMLElement) first.focus();

  return { dialog, close };
}

/** Promise-based confirmation. Resolves true only when the user confirms. */
export function confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    let modal;
    const cancel = button({ label: cancelLabel, variant: 'secondary', onclick: () => modal.close(false), attrs: { 'data-autofocus': '' } });
    const confirm = button({ label: confirmLabel, variant: danger ? 'danger' : 'primary', onclick: () => modal.close(true) });
    modal = openModal({
      title,
      size: 'sm',
      body: h('p', { class: 'confirm-message' }, message),
      footer: [cancel, confirm],
      onClose: (value) => resolve(value === true),
    });
  });
}
