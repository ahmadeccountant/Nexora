// Popover menus/panels anchored to a trigger button. Closes on outside click,
// Escape (returning focus to the trigger) and when focus leaves the panel.

import { h } from '../utils.js';

let counter = 0;

/**
 * @param {object} options
 * @param {HTMLElement} options.trigger Button that toggles the panel.
 * @param {HTMLElement} options.panel Panel element (starts hidden).
 * @param {(()=>void)} [options.onOpen] Called right before the panel opens (refresh its content here).
 */
export function createDropdown({ trigger, panel, onOpen = null }) {
  counter += 1;
  if (!panel.id) panel.id = `dropdown-panel-${counter}`;
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', panel.id);
  panel.hidden = true;

  const wrapper = trigger.parentElement;
  const isOpen = () => !panel.hidden;

  function close({ returnFocus = false } = {}) {
    if (!isOpen()) return;
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (returnFocus) trigger.focus();
  }

  function open() {
    if (isOpen()) return;
    if (onOpen) onOpen();
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    const first = panel.querySelector('[role="menuitem"], button, a[href], input');
    if (first instanceof HTMLElement && panel.dataset.focusFirst === 'true') first.focus();
  }

  trigger.addEventListener('click', () => (isOpen() ? close() : open()));
  document.addEventListener('pointerdown', (event) => {
    if (isOpen() && !wrapper.contains(event.target)) close();
  });
  wrapper.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      event.stopPropagation();
      close({ returnFocus: true });
      return;
    }
    if (isOpen() && panel.getAttribute('role') === 'menu' && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      const items = [...panel.querySelectorAll('[role="menuitem"]')];
      if (!items.length) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement);
      const next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
      items[next].focus();
    }
  });
  wrapper.addEventListener('focusout', (event) => {
    if (isOpen() && event.relatedTarget instanceof Node && !wrapper.contains(event.relatedTarget)) close();
  });

  return { open, close, toggle: () => (isOpen() ? close() : open()), isOpen };
}

/** A single menu item button for role="menu" panels. */
export function menuItem({ label, icon: iconNode, onclick, danger = false }) {
  return h('button', { type: 'button', role: 'menuitem', class: `menu-item${danger ? ' menu-item-danger' : ''}`, onclick }, iconNode, h('span', {}, label));
}
