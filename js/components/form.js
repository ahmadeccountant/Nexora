// Accessible form fields: every input has a visible label, optional hint, and
// an error message wired up with aria-describedby / aria-invalid.

import { h } from '../utils.js';
import { icon } from './ui.js';

let counter = 0;

/**
 * @returns {{ name:string, el:HTMLElement, input:HTMLElement, getValue:()=>string, setError:(msg?:string)=>void }}
 */
export function createField({ name, label, type = 'text', value = '', required = false, hint = '', options = [], rows = 4, attrs = {} }) {
  counter += 1;
  const id = `field-${name}-${counter}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  let input;
  if (type === 'select') {
    input = h(
      'select',
      { id, name, class: 'input' },
      options.map((option) => h('option', { value: option.value, selected: option.value === value, disabled: option.disabled }, option.label)),
    );
  } else if (type === 'textarea') {
    input = h('textarea', { id, name, class: 'input', rows, ...attrs }, value);
  } else {
    input = h('input', { id, name, type, class: 'input', value, ...attrs });
  }
  if (required) input.setAttribute('aria-required', 'true');

  const error = h('p', { class: 'field-error', id: errorId, hidden: true });
  const describedBy = [hint ? hintId : null, errorId].filter(Boolean).join(' ');
  input.setAttribute('aria-describedby', describedBy);

  const el = h(
    'div',
    { class: 'field' },
    h('label', { for: id, class: 'field-label' }, label, required ? h('span', { class: 'field-required', 'aria-hidden': 'true' }, ' *') : null, required ? h('span', { class: 'sr-only' }, ' (required)') : null),
    input,
    hint ? h('p', { class: 'field-hint', id: hintId }, hint) : null,
    error,
  );

  const setError = (message) => {
    error.textContent = message ?? '';
    error.hidden = !message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  };
  input.addEventListener('input', () => setError(''));
  input.addEventListener('change', () => setError(''));

  return { name, el, input, getValue: () => input.value, setError };
}

/** Radio swatches for choosing a project accent color. */
export function createColorField({ name, label, colors, value }) {
  counter += 1;
  const groupId = `field-${name}-${counter}`;
  const errorId = `${groupId}-error`;
  const error = h('p', { class: 'field-error', id: errorId, hidden: true });
  const radios = colors.map((color, index) => {
    const radio = h('input', { type: 'radio', name: `${groupId}-radio`, value: color, id: `${groupId}-${index}`, class: 'swatch-input', checked: color === value });
    const swatch = h(
      'label',
      { class: 'swatch', for: radio.id, style: { background: color }, title: color },
      h('span', { class: 'sr-only' }, `Color ${color}`),
      icon('check'),
    );
    return { radio, swatch };
  });
  const group = h('div', { class: 'swatch-group', role: 'radiogroup', 'aria-labelledby': `${groupId}-label`, 'aria-describedby': errorId }, radios.map(({ radio, swatch }) => [radio, swatch]));
  const el = h('div', { class: 'field' }, h('span', { class: 'field-label', id: `${groupId}-label` }, label), group, error);

  const setError = (message) => {
    error.textContent = message ?? '';
    error.hidden = !message;
  };
  group.addEventListener('change', () => setError(''));
  return {
    name,
    el,
    input: radios[0]?.radio ?? group,
    getValue: () => radios.find(({ radio }) => radio.checked)?.radio.value ?? '',
    setError,
  };
}

/** Show validation messages on fields, focus the first invalid one. Returns true when nothing is invalid. */
export function applyErrors(fields, errors) {
  let firstInvalid = null;
  for (const field of fields) {
    const message = errors[field.name] ?? '';
    field.setError(message);
    if (message && !firstInvalid) firstInvalid = field;
  }
  if (firstInvalid) firstInvalid.input.focus();
  return !firstInvalid;
}

export const readFields = (fields) => Object.fromEntries(fields.map((field) => [field.name, field.getValue()]));
