import { render, screen } from '@testing-library/react';
import { Button } from 'antd';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { OrganizationWorkspaceCard } from './OrganizationWorkspaceCard';

describe('OrganizationWorkspaceCard', () => {
  it('使用当前导航上下文作为标题且不再展示重复标签', () => {
    render(
      <OrganizationWorkspaceCard
        canManageInvites
        title="所有成员"
        actions={<Button>添加成员</Button>}
      >
        成员内容
      </OrganizationWorkspaceCard>,
    );

    expect(screen.getByText('所有成员')).toBeInTheDocument();
    expect(screen.getByText('成员内容')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(
      screen
        .getByRole('button', { name: '添加成员' })
        .closest('.ant-card-head'),
    ).not.toBeNull();
  });
});
