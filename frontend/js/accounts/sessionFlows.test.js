import { describe, expect, test } from 'bun:test';
import { authFlowsFromResult, socialCallbackTarget } from './sessionFlows';

describe('authFlowsFromResult', () => {
  test('reads flows from thrown allauth 401 errors', () => {
    const result = {
      data: {
        status: 401,
        data: {
          flows: [
            { id: 'login' },
            { id: 'verify_phone', is_pending: true },
          ],
        },
      },
    };

    expect(authFlowsFromResult(result)).toEqual(result.data.data.flows);
  });

  test('reads flows from direct allauth session responses', () => {
    const result = {
      data: {
        flows: [
          { id: 'login' },
        ],
      },
    };

    expect(authFlowsFromResult(result)).toEqual(result.data.flows);
  });
});

describe('socialCallbackTarget', () => {
  test('routes pending phone verification to the phone verification screen', () => {
    const target = socialCallbackTarget({
      authenticated: false,
      query: { next: '/dashboard/' },
      flows: [{ id: 'verify_phone', is_pending: true }],
    });

    expect(target).toEqual({
      name: 'verify-phone',
      query: { next: '/dashboard/' },
    });
  });

  test('routes social callback errors to the social error screen', () => {
    const target = socialCallbackTarget({
      authenticated: false,
      query: { error: 'signup_closed', error_process: 'login' },
      flows: [],
    });

    expect(target).toEqual({
      name: 'social-error',
      query: { error: 'signup_closed', error_process: 'login' },
    });
  });
});
