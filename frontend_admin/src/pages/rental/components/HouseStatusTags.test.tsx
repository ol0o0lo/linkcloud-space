import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HouseStatusInlineEditor } from '../houses/HouseListInlineEditors';
import { HouseStatusTags } from './HouseStatusTags';

describe('房源三态与停用标记', () => {
  it('已出租房源同时展示停用标记', () => {
    render(<HouseStatusTags house={{ status: 'rented', is_active: false }} />);
    expect(screen.getByText('已出租')).toBeInTheDocument();
    expect(screen.getByText('已停用')).toBeInTheDocument();
  });

  it('三态并排选择', () => {
    const onChange = vi.fn();
    render(
      <HouseStatusInlineEditor
        value={{ status: 'paused', is_active: true }}
        onChange={onChange}
      />,
    );
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    fireEvent.click(screen.getByRole('radio', { name: '招租中' }));
    expect(onChange).toHaveBeenCalledWith({
      status: 'listed',
      is_active: true,
    });
  });

  it('停用房源不能切换为招租中', () => {
    render(
      <HouseStatusInlineEditor
        value={{ status: 'paused', is_active: false }}
      />,
    );
    expect(screen.getByRole('radio', { name: '招租中' })).toBeDisabled();
  });
});
