// Team page. Members are fictional demo data; nothing is sent to anyone.

import { CURRENT_USER_ID, MEMBER_STATUSES } from '../data/constants.js';
import { avatar, button, notice, progressBar, refreshIcons } from '../components/ui.js';
import { liveTasks, workloadByMember } from '../selectors.js';
import { navigate } from '../router.js';
import { getState } from '../state.js';
import { h, todayStr } from '../utils.js';
import { setTaskFilters } from './tasks.js';

export function createTeamView() {
  let grid;

  function mount(container) {
    grid = h('div', { class: 'team-grid' });
    container.replaceChildren(
      h(
        'div',
        {},
        h('div', { class: 'page-header' }, h('p', { class: 'page-lede' }, 'Who is working on what. Counts come from current tasks in active projects.')),
        notice('Demo team: these members and email addresses are fictional. Nexora doesn’t send invitations or emails.', { iconName: 'info' }),
        h('div', { style: { height: 'var(--space-4)' } }),
        grid,
      ),
    );
  }

  function update() {
    const state = getState();
    const rows = workloadByMember(liveTasks(state), state.team, todayStr());
    grid.replaceChildren(
      ...rows.map(({ member, open, overdue, done, total }) => {
        const status = MEMBER_STATUSES.find((s) => s.id === member.status);
        const percent = total ? Math.round((done / total) * 100) : 0;
        return h(
          'article',
          { class: 'card member-card' },
          h(
            'div',
            { class: 'member-top' },
            avatar(member, { size: 'lg' }),
            h(
              'div',
              {},
              h('h2', { class: 'member-name' }, member.name, member.id === CURRENT_USER_ID ? h('span', { class: 'tag-you' }, 'You') : null),
              h('p', { class: 'member-role' }, member.role),
              h('p', { class: 'member-email' }, member.email),
            ),
          ),
          h('span', { class: 'member-status' }, h('span', { class: `status-dot status-dot-${member.status}`, 'aria-hidden': 'true' }), status?.label ?? member.status),
          h(
            'div',
            { class: 'member-stats' },
            h('div', { class: 'member-stat' }, h('strong', {}, String(open + overdue)), h('span', {}, 'Assigned')),
            h('div', { class: 'member-stat' }, h('strong', {}, String(done)), h('span', {}, 'Completed')),
            h('div', { class: 'member-stat' }, h('strong', {}, String(overdue)), h('span', {}, 'Overdue')),
          ),
          progressBar(percent, { label: `${member.name} completion` }),
          button({
            label: 'View tasks',
            icon: 'list-checks',
            variant: 'secondary',
            onclick: () => {
              setTaskFilters({ assignee: member.id });
              navigate('tasks');
            },
          }),
        );
      }),
    );
    refreshIcons();
  }

  return { mount, update, unmount() {} };
}
