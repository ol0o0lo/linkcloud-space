import { message, notification } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorConfig } from './requestErrorConfig';
import { setSelectedOrgSlug } from './utils/orgSelection';

const { mockHistoryPush, mockRequest } = vi.hoisted(() => ({
  mockHistoryPush: vi.fn(),
  mockRequest: vi.fn(),
}));

vi.mock('antd', () => ({
  message: {
    warning: vi.fn(),
    error: vi.fn(),
  },
  notification: {
    open: vi.fn(),
  },
}));

vi.mock('@umijs/max', () => ({
  getIntl: vi.fn(() => ({
    formatMessage: vi.fn(({ defaultMessage }) => defaultMessage),
  })),
  history: {
    push: mockHistoryPush,
  },
  request: mockRequest,
}));

describe('requestErrorConfig', () => {
  // biome-ignore lint/style/noNonNullAssertion: config handlers are always defined
  const errorThrower = errorConfig.errorConfig!.errorThrower!;
  // biome-ignore lint/style/noNonNullAssertion: config handlers are always defined
  const errorHandler = errorConfig.errorConfig!.errorHandler!;

  beforeEach(() => {
    vi.clearAllMocks();
    setSelectedOrgSlug(undefined);
  });

  describe('errorThrower', () => {
    it('should throw error when success is false', () => {
      const response = {
        success: false,
        data: null,
        errorCode: 400,
        errorMessage: 'Bad Request',
        showType: 2,
      };

      expect(() => {
        errorThrower(response);
      }).toThrow('Bad Request');
    });

    it('should not throw error when success is true', () => {
      const response = {
        success: true,
        data: { id: 1 },
      };

      expect(() => {
        errorThrower(response);
      }).not.toThrow();
    });

    it('should throw BizError with correct info', () => {
      const response = {
        success: false,
        data: { detail: 'more info' },
        errorCode: 403,
        errorMessage: 'Forbidden',
        showType: 3,
      };

      expect.assertions(5);
      try {
        errorThrower(response);
      } catch (error: any) {
        expect(error.name).toBe('BizError');
        expect(error.info.errorCode).toBe(403);
        expect(error.info.errorMessage).toBe('Forbidden');
        expect(error.info.showType).toBe(3);
        expect(error.info.data).toEqual({ detail: 'more info' });
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

    it('should handle SILENT showType', () => {
      const error: any = new Error('Silent error');
      error.name = 'BizError';
      error.info = {
        errorCode: 1001,
        errorMessage: 'Silent error',
        showType: 0,
      };

      errorHandler(error, {});

      expect(message.warning).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
      expect(notification.open).not.toHaveBeenCalled();
    });

    it('should handle WARN_MESSAGE showType', () => {
      const error: any = new Error('Warning');
      error.name = 'BizError';
      error.info = {
        errorCode: 1002,
        errorMessage: 'This is a warning',
        showType: 1,
      };

      errorHandler(error, {});

      expect(message.warning).toHaveBeenCalledWith('This is a warning');
    });

    it('should handle ERROR_MESSAGE showType', () => {
      const error: any = new Error('Error message');
      error.name = 'BizError';
      error.info = {
        errorCode: 1003,
        errorMessage: 'This is an error',
        showType: 2,
      };

      errorHandler(error, {});

      expect(message.error).toHaveBeenCalledWith('This is an error');
    });

    it('should handle NOTIFICATION showType', () => {
      const error: any = new Error('Notification');
      error.name = 'BizError';
      error.info = {
        errorCode: 1004,
        errorMessage: 'This is a notification',
        showType: 3,
      };

      errorHandler(error, {});

      expect(notification.open).toHaveBeenCalledWith({
        title: 1004,
        description: 'This is a notification',
      });
    });

    it('should handle REDIRECT showType', () => {
      const error: any = new Error('Redirect');
      error.name = 'BizError';
      error.info = {
        errorCode: 401,
        errorMessage: 'Unauthorized',
        showType: 9,
      };

      errorHandler(error, {});

      expect(mockHistoryPush).toHaveBeenCalledWith('/user/login');
      expect(message.warning).not.toHaveBeenCalled();
      expect(message.error).not.toHaveBeenCalled();
      expect(notification.open).not.toHaveBeenCalled();
    });

    it('should handle default case for unknown showType', () => {
      const error: any = new Error('Unknown type');
      error.name = 'BizError';
      error.info = {
        errorCode: 1005,
        errorMessage: 'Unknown error type',
        showType: 99,
      };

      errorHandler(error, {});

      expect(message.error).toHaveBeenCalledWith('Unknown error type');
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
        url: '/api/users/me/avatar/',
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
