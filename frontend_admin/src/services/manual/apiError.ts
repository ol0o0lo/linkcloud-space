type ErrorPayload = {
  error?: unknown;
  data?: unknown;
};

export function getResourceInUseData(error: unknown): API.DeleteCheckOut | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as { info?: ErrorPayload; response?: { data?: ErrorPayload } };
  const payload = candidate.info ?? candidate.response?.data;
  return payload?.error === 'RESOURCE_IN_USE' ? (payload.data as API.DeleteCheckOut) : undefined;
}
