import { message } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorConfig } from './requestErrorConfig';
import { setSelectedOrgSlug } from './utils/orgSelection';

const { mockHistory, mockHistoryPush, mockRequest } = vi.hoisted(() => ({
  mockHistory: {
    location: {
      pathname: '/property-rental/workbench',
      search: '',
      hash: '',
    },
    push: vi.fn(),
  },
  mockHistoryPush: vi.fn(),
  mockRequest: vi.fn(),
}));
mockHistory.push = mockHistoryPush;

vi.mock('antd', () => ({
  message: {
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@umijs/max', () => ({
  getIntl: vi.fn(() => ({
    formatMessage: vi.fn(({ defaultMessage }) => defaultMessage),
  })),
  history: mockHistory,
  request: mockRequest,
}));

describe('requestErrorConfig', () => {
  // biome-ignore lint/style/noNonNullAssertion: config handlers are always defined
  const errorThrower = errorConfig.errorConfig!.errorThrower!;
  // biome-ignore lint/style/noNonNullAssertion: config handlers are always defined
  const errorHandler = errorConfig.errorConfig!.errorHandler!;
  const responseInterceptor = errorConfig.responseInterceptors?.[0] as unknown as (response: {
    data?: unknown;
    status?: number;
  }) => {
    data?: unknown;
    status?: number;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setSelectedOrgSlug(undefined);
    mockHistory.location = {
      pathname: '/property-rental/workbench',
      search: '',
      hash: '',
    };
  });

  describe('errorThrower', () => {
    it('should throw error when API envelope code is not 200', () => {
      const response = {
        code: 409,
        error: 'ROLE_IN_USE',
        message: '角色仍被用户引用，无法删除。',
        data: { fields: { role: ['角色仍被用户引用，无法删除。'] } },
        timestamp: 1718809200,
        traceId: '',
      };

      expect(() => {
        errorThrower(response);
      }).toThrow('角色仍被用户引用，无法删除。');
    });

    it('should not throw error when API envelope code is 200', () => {
      const response = {
        code: 200,
        message: 'success',
        data: { id: 1 },
        timestamp: 1718809200,
        traceId: '',
      };

      expect(() => {
        errorThrower(response);
      }).not.toThrow();
    });

    it('should throw BizError with correct info', () => {
      const response = {
        code: 403,
        error: 'FORBIDDEN',
        message: 'Forbidden',
        data: null,
        timestamp: 1718809200,
        traceId: '',
      };

      expect.assertions(4);
      try {
        errorThrower(response);
      } catch (error: any) {
        expect(error.name).toBe('BizError');
        expect(error.info.code).toBe(403);
        expect(error.info.error).toBe('FORBIDDEN');
        expect(error.info.message).toBe('Forbidden');
      }
    });
  });

  describe('errorHandler', () => {
    it('should rethrow error when skipErrorHandler is true', () => {
      const error = new Error('Test error');
      const opts = { skipErrorHandler: true };

      expect(() => {
        errorHandler(error, opts);
      }).toThrow('Test error');
    });

    it('should handle BizError message', () => {
      const error: any = new Error('Error message');
      error.name = 'BizError';
      error.info = {
        code: 409,
        error: 'ROLE_IN_USE',
        message: 'This is an error',
        data: null,
        timestamp: 1718809200,
        traceId: '',
      };

      errorHandler(error, {});

      expect(message.error).toHaveBeenCalledWith('This is an error');
    });

    it('should redirect login for 401 BizError', () => {
      const error: any = new Error('Redirect');
      error.name = 'BizError';
      error.info = {
        code: 401,
        error: 'UNAUTHORIZED',
        message: 'Unauthorized',
        data: null,
        timestamp: 1718809200,
        traceId: '',
      };

      errorHandler(error, {});

      expect(mockHistoryPush).toHaveBeenCalledWith('/user/login?redirect=%2Fproperty-rental%2Fworkbench');
      expect(message.error).not.toHaveBeenCalled();
    });

    it('should not redirect again when already on login page', () => {
      mockHistory.location = {
        pathname: '/dashboard/user/login',
        search: '',
        hash: '',
      };
      const error: any = new Error('Redirect');
      error.name = 'BizError';
      error.info = {
        code: 401,
        error: 'UNAUTHORIZED',
        message: 'Unauthorized',
        data: null,
        timestamp: 1718809200,
        traceId: '',
      };

      errorHandler(error, {});

      expect(mockHistoryPush).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
    });

    it('should handle axios response error', () => {
      const error: any = new Error('Axios error');
      error.response = {
        status: 500,
        data: {},
      };

      errorHandler(error, {});

      expect(message.error).toHaveBeenCalledWith('Response status:500');
    });

    it('should show message from API error envelope', () => {
      const error: any = new Error('API error');
      error.response = {
        status: 409,
        data: {
          code: 409,
          error: 'ROLE_IN_USE',
          message: '角色仍被用户引用，无法删除。',
          data: {
            fields: {
              role: ['角色仍被用户引用，无法删除。'],
            },
          },
          timestamp: 1718809200,
          traceId: '',
        },
      };

      errorHandler(error, {});

      expect(message.error).toHaveBeenCalledWith('角色仍被用户引用，无法删除。');
    });

    it('should fall back to status for non-envelope error response', () => {
      const error: any = new Error('Legacy API error');
      error.response = {
        status: 400,
        data: {
          role: ['Role is still assigned to users and cannot be deleted.'],
        },
      };

      errorHandler(error, {});

      expect(message.error).toHaveBeenCalledWith('Response status:400');
    });

    it('should handle offline error', () => {
      const error: any = new Error('Network error');
      error.request = {};

      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      try {
        errorHandler(error, {});

        expect(message.error).toHaveBeenCalledWith(
          'Network unavailable. Please check your connection and try again.',
        );
      } finally {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: originalOnLine,
        });
      }
    });

    it('should handle request error with no response', () => {
      const error: any = new Error('Request error');
      error.request = {};

      errorHandler(error, {});

      expect(message.error).toHaveBeenCalledWith(
        'None response! Please retry.',
      );
    });

    it('should handle generic error', () => {
      const error: any = new Error('Generic error');

      errorHandler(error, {});

      expect(message.error).toHaveBeenCalledWith(
        'Request error, please retry.',
      );
    });
  });

  describe('responseInterceptors', () => {
    it('should unwrap successful API envelope', () => {
      const response = {
        status: 200,
        data: {
          code: 200,
          message: 'success',
          data: { id: 1, name: 'Admin' },
          timestamp: 1718809200,
          traceId: '',
        },
      };

      const result = responseInterceptor(response);

      expect(result.data).toEqual({ id: 1, name: 'Admin' });
    });

    it('should keep non-envelope response unchanged', () => {
      const response = {
        status: 200,
        data: { ok: true },
      };

      const result = responseInterceptor(response);

      expect(result).toBe(response);
    });
  });

  describe('requestInterceptors', () => {
    // The interceptor is registered as a plain function (not a tuple),
    // so narrow the union type to a callable for the test.
    const interceptor = errorConfig.requestInterceptors?.[0] as (config: {
      credentials?: string;
      headers?: Record<string, string>;
      url?: string;
      method?: string;
    }) => Promise<{
      credentials?: string;
      headers?: Record<string, string>;
      url?: string;
    }>;

    it('should pass through config without modification', async () => {
      const config = {
        url: 'https://api.example.com/users',
        method: 'GET',
      };

      const result = await interceptor(config);

      // Token attachment is intentionally commented out in the source;
      // interceptor currently returns config as-is
      expect(result.url).toBe('https://api.example.com/users');
    });

    it('should handle URL without config', async () => {
      const config = {};

      const result = await interceptor(config);

      expect(result.url).toBeUndefined();
    });

    it('should attach csrf token and credentials to mutating requests', async () => {
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        writable: true,
        value: 'csrftoken=test-token',
      });
      setSelectedOrgSlug('acme');

      const config = {
        headers: {},
        method: 'POST',
        url: '/api/media/upload/',
      };

      const result = await interceptor(config);

      expect(result.credentials).toBe('include');
      expect(result.headers).toEqual(
        expect.objectContaining({
          'X-CSRFToken': 'test-token',
          'X-Org-Slug': 'acme',
        }),
      );
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('should fetch csrf token when missing for mutating requests', async () => {
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        writable: true,
        value: '',
      });
      mockRequest.mockImplementationOnce(async (url: string) => {
        if (url === '/api/allauth/browser/v1/config') {
          document.cookie = 'csrftoken=fetched-token';
        }
        return { status: 200 };
      });

      const config = {
        headers: {},
        method: 'PATCH',
        url: '/api/users/7/',
      };

      const result = await interceptor(config);

      expect(mockRequest).toHaveBeenCalledWith(
        '/api/allauth/browser/v1/config',
        expect.objectContaining({
          credentials: 'include',
          method: 'GET',
        }),
      );
      expect(result.headers).toEqual(
        expect.objectContaining({
          'X-CSRFToken': 'fetched-token',
        }),
      );
      expect(result.credentials).toBe('include');
    });

    it('should skip csrf injection for safe methods', async () => {
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        writable: true,
        value: 'csrftoken=test-token',
      });
      setSelectedOrgSlug('acme');

      const config = {
        headers: {},
        method: 'GET',
        url: '/api/users/me/',
      };

      const result = await interceptor(config);

      expect(result.credentials).toBeUndefined();
      expect(result.headers).toEqual({
        'X-Org-Slug': 'acme',
      });
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('should not inject X-Org-Slug when no organization is selected', async () => {
      const config = {
        headers: {},
        method: 'GET',
        url: '/api/users/me/',
      };

      const result = await interceptor(config);

      expect(result.headers).toEqual({});
    });
  });
});
