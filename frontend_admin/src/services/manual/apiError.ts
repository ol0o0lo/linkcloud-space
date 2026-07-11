type ErrorPayload = {
  error?: unknown;
  data?: unknown;
};

function isDeleteCheckOut(value: unknown): value is API.DeleteCheckOut {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as { can_delete?: unknown; resources?: unknown };
  return typeof candidate.can_delete === 'boolean' && Array.isArray(candidate.resources);
}

export function getResourceInUseData(error: unknown): API.DeleteCheckOut | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as { info?: ErrorPayload; response?: { data?: ErrorPayload } };
  const payload = candidate.info ?? candidate.response?.data;
  return payload?.error === 'RESOURCE_IN_USE' && isDeleteCheckOut(payload.data) ? payload.data : undefined;
}
