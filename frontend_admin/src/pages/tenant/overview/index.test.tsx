import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import OverviewPage from './index';

vi.mock('@umijs/max', () => ({
  Navigate: ({ replace, to }: { replace?: boolean; to: string }) => (
    <span data-replace={String(Boolean(replace))}>redirect:{to}</span>
  ),
}));

describe('OverviewPage', () => {
  it('redirects to member management', () => {
    render(<OverviewPage />);

    expect(screen.getByText('redirect:/tenant/members')).toHaveAttribute(
      'data-replace',
      'true',
    );
  });
});
