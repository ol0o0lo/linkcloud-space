import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PageContainer } from './index';

vi.mock('@ant-design/pro-components', () => ({
  PageContainer: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: React.ReactNode | false;
  }) => (
    <section data-testid="page-container" data-title={String(title)}>
      {title ? <h1>{title}</h1> : null}
      {children}
    </section>
  ),
}));

describe('PageContainer', () => {
  it('默认隐藏与面包屑重复的页面标题', () => {
    render(
      <PageContainer title="房源地图">
        <div>地图内容</div>
      </PageContainer>,
    );

    expect(screen.getByTestId('page-container')).toHaveAttribute(
      'data-title',
      'false',
    );
    expect(
      screen.queryByRole('heading', { name: '房源地图' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('地图内容')).toBeInTheDocument();
  });

  it('允许详情页显式保留独立上下文标题', () => {
    render(
      <PageContainer title="单号：234231029431" showTitle>
        <div>订单详情</div>
      </PageContainer>,
    );

    expect(
      screen.getByRole('heading', { name: '单号：234231029431' }),
    ).toBeInTheDocument();
  });
});
