// Notifications built from real local data (overdue and soon-due work).
// Nothing is emailed or pushed; read state is stored with the rest of the data.

import { createDropdown } from '../components/dropdown.js';
import { button, icon, refreshIcons } from '../components/ui.js';
import { buildNotifications } from '../selectors.js';
import { navigate } from '../router.js';
import { getState, markNotificationsRead } from '../state.js';
import { h } from '../utils.js';

export function initNotifications({ trigger, badge, panel }) {
  const dropdown = createDropdown({ trigger, panel, onOpen: render });

  function render() {
    const items = buildNotifications(getState());
    const unread = items.filter((n) => !n.read);
    panel.replaceChildren(
      h(
        'div',
        { class: 'notif-header' },
        h('strong', {}, 'Notifications'),
        button({ label: 'Mark all as read', variant: 'ghost', onclick: () => markNotificationsRead(items.map((n) => n.id)), disabled: unread.length === 0, attrs: { class: 'btn btn-ghost btn-sm' } }),
      ),
      items.length
        ? h(
            'ul',
            { class: 'notif-list' },
            items.map((item) =>
              h(
                'li',
                {},
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'notif-item',
                    dataset: { read: String(item.read) },
                    onclick: () => {
                      markNotificationsRead([item.id]);
                      dropdown.close();
                      navigate(item.route);
                    },
                  },
                  h('span', { class: `activity-icon${item.kind === 'overdue' ? ' activity-icon-danger' : ''}` }, icon(item.kind === 'overdue' ? 'triangle-alert' : 'clock')),
                  h('span', { class: 'notif-body' }, h('span', { class: 'notif-title' }, item.title), h('span', { class: 'notif-detail' }, item.detail)),
                  item.read ? null : h('span', { class: 'notif-unread', 'aria-label': 'Unread' }),
                ),
              ),
            ),
          )
        : h('p', { class: 'search-empty' }, 'You’re all caught up. Nothing is overdue or due soon.'),
      h('p', { class: 'notif-footer' }, 'Built from your tasks and projects. No emails or push notifications are sent.'),
    );
    refreshIcons();
  }

  function refresh() {
    const unread = buildNotifications(getState()).filter((n) => !n.read).length;
    badge.hidden = unread === 0;
    badge.textContent = unread > 99 ? '99+' : String(unread);
    trigger.setAttribute('aria-label', unread ? `Notifications, ${unread} unread` : 'Notifications');
    if (dropdown.isOpen()) render();
  }

  return { refresh };
}
