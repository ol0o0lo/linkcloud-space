import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import RegisterResult from '.';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  Navigate: (props: { replace?: boolean; to: string }) => {
    mocks.navigate(props);
    return <div data-testid="legacy-register-redirect" />;
  },
  useLocation: () => ({
    search: '?invite_code=ABC123&referral_source=link',
  }),
  useSearchParams: () => [new URLSearchParams()],
}));

describe('遗留注册结果页', () => {
  it('携带原查询参数回到真实注册流程且不再展示伪成功状态', () => {
    render(<RegisterResult />);

    expect(mocks.navigate).toHaveBeenCalledWith({
      replace: true,
      to: '/user/register?invite_code=ABC123&referral_source=link',
    });
    expect(screen.getByTestId('legacy-register-redirect')).toBeInTheDocument();
    expect(screen.queryByText(/注册成功/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '查看邮箱' }),
    ).not.toBeInTheDocument();
  });
});
