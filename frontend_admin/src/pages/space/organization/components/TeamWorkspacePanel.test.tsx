import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamRoleSettingsAction } from './TeamWorkspacePanel';

vi.mock('@ant-design/pro-components', () => ({ ProTable: () => null }));

describe('TeamRoleSettingsAction', () => {
  it('打开当前团队的角色定义', () => {
    const onOpen = vi.fn();

    render(<TeamRoleSettingsAction teamId={3} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /管理角色定义/ }));

    expect(onOpen).toHaveBeenCalledWith(3);
  });
});
