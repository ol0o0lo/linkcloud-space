import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceDeleteModal } from './ResourceDeleteModal';

const { mockCheckEstateDelete, mockDeleteEstate } = vi.hoisted(() => ({
  mockCheckEstateDelete: vi.fn(),
  mockDeleteEstate: vi.fn(),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    checkEstateDelete: mockCheckEstateDelete,
    deleteEstate: mockDeleteEstate,
  },
}));

const blockedCheck = {
  can_delete: false,
  resources: [
    {
      type: 'building',
      label: '关联楼栋',
      count: 1,
      items: [{ id: 11, label: '1栋 · 科技路 1 号' }],
      truncated: false,
      target: {
        path: '/property-rental/estates',
        query: { view: 'buildings', estate_id: 10 },
      },
    },
  ],
};

describe('ResourceDeleteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('检查发现关联资源时禁止删除并提供跳转', async () => {
    mockCheckEstateDelete.mockResolvedValue(blockedCheck);
    render(
      <ResourceDeleteModal
        open
        target={{ type: 'estate', id: 10, label: '星河湾' }}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    expect(
      await screen.findByText('当前记录存在关联资源，不能删除'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '确认删除' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '查看全部关联楼栋' }),
    ).toHaveAttribute(
      'href',
      '/dashboard/property-rental/estates?view=buildings&estate_id=10',
    );
  });

  it('删除返回资源占用冲突时原地切换为禁止状态', async () => {
    mockCheckEstateDelete.mockResolvedValue({
      can_delete: true,
      resources: [],
    });
    mockDeleteEstate.mockRejectedValue({
      info: { error: 'RESOURCE_IN_USE', data: blockedCheck },
    });
    render(
      <ResourceDeleteModal
        open
        target={{ type: 'estate', id: 10, label: '星河湾' }}
        onClose={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    expect(await screen.findByText('确认删除“星河湾”？')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    expect(
      await screen.findByText('当前记录存在关联资源，不能删除'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '确认删除' }),
    ).not.toBeInTheDocument();
  });

  it('旧删除请求完成时不会影响已切换到的新删除目标', async () => {
    let resolveDelete: (() => void) | undefined;
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    mockCheckEstateDelete.mockResolvedValue({
      can_delete: true,
      resources: [],
    });
    mockDeleteEstate.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );
    const { rerender } = render(
      <ResourceDeleteModal
        open
        target={{ type: 'estate', id: 10, label: '星河湾' }}
        onClose={onClose}
        onDeleted={onDeleted}
      />,
    );

    expect(await screen.findByText('确认删除“星河湾”？')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    rerender(
      <ResourceDeleteModal
        open
        target={{ type: 'estate', id: 20, label: '月亮湾' }}
        onClose={onClose}
        onDeleted={onDeleted}
      />,
    );
    expect(await screen.findByText('确认删除“月亮湾”？')).toBeInTheDocument();

    await act(async () => {
      resolveDelete?.();
    });
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('确认删除“月亮湾”？')).toBeInTheDocument();
  });
});
