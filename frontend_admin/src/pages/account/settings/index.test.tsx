import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import Settings from './index';

vi.mock('../components/personal-center-page', () => ({
  default: () => <div>新个人中心</div>,
}));

describe('Settings page compatibility route', () => {
  it('reuses the personal center page', () => {
    render(<Settings />);

    expect(screen.getByText('新个人中心')).toBeInTheDocument();
  });
});
