// Validation for user input. Returns { valid, errors, value } where `value`
// is the cleaned object and `errors` maps field names to messages.

import { PRIORITIES, PROJECT_STATUSES, TASK_STATUSES } from './data/constants.js';
import { isValidDateStr, normalizeTags } from './utils.js';

const has = (list, id) => list.some((item) => item.id === id);
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function validateProjectInput(input, { team }) {
  const errors = {};
  const value = {
    name: String(input.name ?? '').trim(),
    description: String(input.description ?? '').trim(),
    ownerId: String(input.ownerId ?? ''),
    status: String(input.status ?? ''),
    startDate: String(input.startDate ?? ''),
    dueDate: String(input.dueDate ?? ''),
    color: String(input.color ?? ''),
  };

  if (!value.name) errors.name = 'Enter a project name.';
  else if (value.name.length > 80) errors.name = 'Use 80 characters or fewer.';

  if (value.description.length > 500) errors.description = 'Use 500 characters or fewer.';

  if (!value.ownerId) errors.ownerId = 'Choose a project owner.';
  else if (!has(team, value.ownerId)) errors.ownerId = 'That owner no longer exists. Choose another.';

  if (!has(PROJECT_STATUSES, value.status)) errors.status = 'Choose a valid status.';

  if (!value.startDate) errors.startDate = 'Choose a start date.';
  else if (!isValidDateStr(value.startDate)) errors.startDate = 'Enter a valid date.';

  if (!value.dueDate) errors.dueDate = 'Choose a due date.';
  else if (!isValidDateStr(value.dueDate)) errors.dueDate = 'Enter a valid date.';
  else if (!errors.startDate && value.dueDate < value.startDate) {
    errors.dueDate = 'Due date can’t be earlier than the start date.';
  }

  if (!HEX_COLOR.test(value.color)) errors.color = 'Choose an accent color.';

  return { valid: Object.keys(errors).length === 0, errors, value };
}

export function validateTaskInput(input, { projects, team }) {
  const errors = {};
  const value = {
    title: String(input.title ?? '').trim(),
    description: String(input.description ?? '').trim(),
    projectId: String(input.projectId ?? ''),
    assigneeId: String(input.assigneeId ?? ''),
    status: String(input.status ?? ''),
    priority: String(input.priority ?? ''),
    dueDate: String(input.dueDate ?? ''),
    tags: normalizeTags(input.tags),
  };

  if (!value.title) errors.title = 'Enter a task title.';
  else if (value.title.length > 120) errors.title = 'Use 120 characters or fewer.';

  if (value.description.length > 1000) errors.description = 'Use 1,000 characters or fewer.';

  if (!value.projectId) errors.projectId = 'Choose a project.';
  else if (!has(projects, value.projectId)) errors.projectId = 'That project no longer exists. Choose another.';

  if (value.assigneeId && !has(team, value.assigneeId)) {
    errors.assigneeId = 'That team member no longer exists. Choose another.';
  }

  if (!has(TASK_STATUSES, value.status)) errors.status = 'Choose a valid status.';
  if (!has(PRIORITIES, value.priority)) errors.priority = 'Choose a valid priority.';

  if (value.dueDate && !isValidDateStr(value.dueDate)) errors.dueDate = 'Enter a valid date.';

  if (value.tags.length > 8) errors.tags = 'Use 8 tags or fewer.';
  else if (value.tags.some((tag) => tag.length > 24)) errors.tags = 'Keep each tag under 24 characters.';

  return { valid: Object.keys(errors).length === 0, errors, value };
}

export function validateDisplayName(name) {
  const value = String(name ?? '').trim();
  if (!value) return { valid: false, error: 'Enter a display name.', value };
  if (value.length > 40) return { valid: false, error: 'Use 40 characters or fewer.', value };
  return { valid: true, error: '', value };
}
