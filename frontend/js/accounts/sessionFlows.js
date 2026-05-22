export function authFlowsFromResult(result) {
  return result?.data?.flows || result?.data?.data?.flows || [];
}

export function socialCallbackTarget({ authenticated, query, flows }) {
  if (authenticated) {
    return query.next || '/';
  }

  if (query.error) {
    return {
      name: 'social-error',
      query: {
        error: query.error,
        error_process: query.error_process,
      },
    };
  }

  const phoneStage = flows.find((flow) => flow.id === 'verify_phone' && flow.is_pending);

  if (phoneStage) {
    return {
      name: 'verify-phone',
      query: { next: query.next },
    };
  }

  return { name: 'login' };
}
