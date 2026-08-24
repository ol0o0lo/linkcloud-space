import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TreeSectionHeader } from './index';

describe('TreeSectionHeader', () => {
  it('统一渲染分组名称、创建操作和全部折叠操作', () => {
    const onCreate = vi.fn();
    const onCollapseAll = vi.fn();

    render(
      <TreeSectionHeader
        title="团队"
        count={2}
        createAction={{ label: '新建团队', onClick: onCreate }}
        collapseAllAction={{ onClick: onCollapseAll }}
      />,
    );

    expect(screen.getByText('团队 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '新建团队' }));
    fireEvent.click(screen.getByRole('button', { name: '全部折叠' }));

    expect(onCreate).toHaveBeenCalledOnce();
    expect(onCollapseAll).toHaveBeenCalledOnce();
  });
});
