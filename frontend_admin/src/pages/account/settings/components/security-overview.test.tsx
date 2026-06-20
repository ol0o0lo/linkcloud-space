import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import SecurityOverview from './security-overview';

vi.mock('./security', () => ({
  default: () => <div>SecurityView content</div>,
}));
vi.mock('./binding', () => ({ default: () => <div>BindingView content</div> }));
vi.mock('./real-name', () => ({
  RealNameView: () => <div>RealNameView content</div>,
}));

describe('SecurityOverview', () => {
  it('renders login verification, third-party bindings and identity verification sections', () => {
    render(<SecurityOverview />);

    expect(screen.getByText('登录与验证')).toBeInTheDocument();
    expect(screen.getByText('第三方绑定')).toBeInTheDocument();
    expect(screen.getByText('身份认证')).toBeInTheDocument();
    expect(screen.getByText('SecurityView content')).toBeInTheDocument();
    expect(screen.getByText('BindingView content')).toBeInTheDocument();
    expect(screen.getByText('RealNameView content')).toBeInTheDocument();
  });
});
