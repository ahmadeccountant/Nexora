// Global search over projects and tasks, using the ARIA combobox/listbox pattern.

import { icon, refreshIcons } from '../components/ui.js';
import { navigate } from '../router.js';
import { getState } from '../state.js';
import { debounce, h, indexById } from '../utils.js';
import { statusLabel } from '../data/constants.js';

const MAX_PER_GROUP = 5;

function findMatches(query) {
  const q = query.toLowerCase();
  const { projects, tasks } = getState();
  const byId = indexById(projects);
  const projectHits = projects
    .filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    .slice(0, MAX_PER_GROUP)
    .map((p) => ({ kind: 'project', id: p.id, title: p.name, meta: p.status === 'archived' ? 'Project · archived' : 'Project', route: `projects/${p.id}`, icon: 'folder-kanban' }));
  const taskHits = tasks
    .filter((t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tags.some((tag) => tag.toLowerCase().includes(q)))
    .slice(0, MAX_PER_GROUP)
    .map((t) => ({ kind: 'task', id: t.id, title: t.title, meta: `${byId.get(t.projectId)?.name ?? 'Task'} · ${statusLabel(t.status)}`, route: `tasks/${t.id}`, icon: 'square-check-big' }));
  return { projectHits, taskHits };
}

export function initGlobalSearch({ input, panel }) {
  let options = [];
  let active = -1;

  const isOpen = () => !panel.hidden;

  function close() {
    panel.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function setActive(index) {
    const nodes = panel.querySelectorAll('[role="option"]');
    nodes.forEach((node, i) => node.setAttribute('aria-selected', String(i === index)));
    active = index;
    if (index >= 0 && nodes[index]) {
      input.setAttribute('aria-activedescendant', nodes[index].id);
      nodes[index].scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }

  function choose(index) {
    const option = options[index];
    if (!option) return;
    input.value = '';
    close();
    input.blur();
    navigate(option.route);
  }

  function render() {
    const query = input.value.trim();
    if (!query) return close();
    const { projectHits, taskHits } = findMatches(query);
    options = [...projectHits, ...taskHits];
    panel.replaceChildren();
    if (!options.length) {
      panel.append(h('p', { class: 'search-empty', role: 'status' }, `No projects or tasks match “${query}”.`));
    } else {
      let index = 0;
      const group = (label, hits) => {
        if (!hits.length) return;
        panel.append(h('div', { class: 'search-group', role: 'presentation' }, label));
        hits.forEach((hit) => {
          const i = index;
          index += 1;
          panel.append(
            h(
              'div',
              { class: 'search-option', role: 'option', id: `search-option-${i}`, 'aria-selected': 'false', tabindex: '-1', onmousedown: (event) => event.preventDefault(), onclick: () => choose(i) },
              icon(hit.icon),
              h('span', { class: 'search-option-text' }, h('span', { class: 'search-option-title' }, hit.title), h('span', { class: 'search-option-meta' }, hit.meta)),
            ),
          );
        });
      };
      group('Projects', projectHits);
      group('Tasks', taskHits);
    }
    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    active = -1;
    refreshIcons();
  }

  input.addEventListener('input', debounce(render, 100));
  input.addEventListener('focus', () => input.value.trim() && render());
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (isOpen()) {
        close();
        event.stopPropagation();
      } else input.value = '';
      return;
    }
    if (!isOpen() || !options.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((active + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((active - 1 + options.length) % options.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(active >= 0 ? active : 0);
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (isOpen() && !input.parentElement.contains(event.target)) close();
  });
  input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input && !panel.contains(document.activeElement)) close(); }, 120));

  // "/" focuses search unless the user is already typing somewhere.
  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    const el = document.activeElement;
    if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
    if (document.querySelector('dialog[open]')) return;
    event.preventDefault();
    input.focus();
  });
}
