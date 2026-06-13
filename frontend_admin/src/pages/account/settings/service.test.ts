import { request } from '@umijs/max';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { querySocialBindings, startSocialBinding } from './service';

vi.mock('@umijs/max', () => ({
  request: vi.fn(),
}));

const mockRequest = vi.mocked(request);

describe('account settings service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    document.body.innerHTML = '';
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      writable: true,
      value: 'csrftoken=test-csrf-token',
    });
  });

  it('queries current social binding states from the dedicated api', async () => {
    mockRequest.mockResolvedValueOnce({
      items: [
        { provider: 'github', label: 'GitHub', connected: false },
        { provider: 'weixin', label: '微信', connected: true },
      ],
    });

    const result = await querySocialBindings();

    expect(mockRequest).toHaveBeenCalledWith(
      '/api/users/me/social-bindings/',
      expect.objectContaining({
        credentials: 'include',
        method: 'GET',
      }),
    );
    expect(result.items[1]).toEqual({ provider: 'weixin', label: '微信', connected: true });
  });

  it('submits a top-level form post to the allauth provider redirect endpoint', async () => {
    const submit = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'form') {
        Object.defineProperty(element, 'submit', { value: submit });
      }
      return element;
    }) as typeof document.createElement);

    await startSocialBinding('github');

    const form = document.body.querySelector('form');
    expect(form?.getAttribute('action')).toBe('/api/allauth/browser/v1/auth/provider/redirect');
    expect(form?.getAttribute('method')).toBe('POST');
    expect(form?.querySelector('input[name="provider"]')?.getAttribute('value')).toBe('github');
    expect(form?.querySelector('input[name="process"]')?.getAttribute('value')).toBe('login');
    expect(form?.querySelector('input[name="csrfmiddlewaretoken"]')?.getAttribute('value')).toBe('test-csrf-token');
    expect(form?.querySelector('input[name="callback_url"]')?.getAttribute('value')).toBe(`${window.location.origin}/account/settings?tab=binding`);
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
