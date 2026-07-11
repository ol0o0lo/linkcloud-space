type ErrorPayload = {
  error?: unknown;
  data?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isRelatedResourceItem(value: unknown): boolean {
  return isObject(value) && typeof value.id === 'number' && typeof value.label === 'string';
}

function isRelatedResource(value: unknown): boolean {
  if (!isObject(value) || !isObject(value.target)) {
    return false;
  }

  const { target } = value;
  return (
    typeof value.type === 'string' &&
    typeof value.label === 'string' &&
    typeof value.count === 'number' &&
    Array.isArray(value.items) &&
    value.items.every(isRelatedResourceItem) &&
    typeof value.truncated === 'boolean' &&
    typeof target.path === 'string' &&
    isObject(target.query) &&
    !Array.isArray(target.query)
  );
}

function isDeleteCheckOut(value: unknown): value is API.DeleteCheckOut {
  if (!isObject(value)) {
    return false;
  }

  return typeof value.can_delete === 'boolean' && Array.isArray(value.resources) && value.resources.every(isRelatedResource);
}

export function getResourceInUseData(error: unknown): API.DeleteCheckOut | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as { info?: ErrorPayload; response?: { data?: ErrorPayload } };
  const payload = candidate.info ?? candidate.response?.data;
  return payload?.error === 'RESOURCE_IN_USE' && isDeleteCheckOut(payload.data) ? payload.data : undefined;
}
