import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdvancedFilterToolbar } from './index';
import { resolveResponsiveFilterOverflow } from './overflow';

describe('AdvancedFilterToolbar', () => {
  it('moves lower priorities first and falls back to left-to-right order', () => {
    expect(
      resolveResponsiveFilterOverflow({
        availableWidth: 320,
        fixedWidths: [100],
        gap: 10,
        items: [
          { key: 'first', priority: 20, width: 100 },
          { key: 'second', priority: 10, width: 100 },
          { key: 'third', priority: 30, width: 100 },
        ],
      }),
    ).toEqual(['second']);

    expect(
      resolveResponsiveFilterOverflow({
        availableWidth: 210,
        fixedWidths: [100],
        gap: 10,
        items: [
          { key: 'first', width: 100 },
          { key: 'second', width: 100 },
          { key: 'third', width: 100 },
        ],
      }),
    ).toEqual(['first', 'second']);
  });

  it('supports an uncontrolled default-open drawer and reset without submitting', async () => {
    const onConfirm = vi.fn();
    const onReset = vi.fn();

    render(
      <AdvancedFilterToolbar
        defaultOpen
        advancedContent={<div>高级内容</div>}
        onConfirm={onConfirm}
        onReset={onReset}
      >
        <span>常驻筛选</span>
      </AdvancedFilterToolbar>,
    );

    expect(screen.getByText('常驻筛选')).toBeInTheDocument();
    expect(screen.getByText('高级内容')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /重\s*置/ }));
    expect(onReset).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /取\s*消/ }));
    await waitFor(() =>
      expect(screen.queryByText('高级内容')).not.toBeInTheDocument(),
    );
  });

  it('notifies controlled open changes without overriding the controlled value', () => {
    const onOpenChange = vi.fn();

    render(
      <AdvancedFilterToolbar
        open={false}
        advancedContent={<div>高级内容</div>}
        triggerAriaLabel="高级筛选"
        triggerText={null}
        onConfirm={vi.fn()}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.queryByText('高级筛选')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '高级筛选' }));

    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByText('高级内容')).not.toBeInTheDocument();
  });

  it('closes after successful confirmation and stays open after failure', async () => {
    const onConfirm = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce();

    render(
      <AdvancedFilterToolbar
        defaultOpen
        advancedContent={<div>高级内容</div>}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '确定筛选' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(screen.getByText('高级内容')).toBeInTheDocument();
    const confirmButton = screen.getByText('确定筛选').closest('button');
    await waitFor(() =>
      expect(confirmButton).not.toHaveClass('ant-btn-loading'),
    );

    fireEvent.click(confirmButton as HTMLButtonElement);
    await waitFor(() =>
      expect(screen.queryByText('高级内容')).not.toBeInTheDocument(),
    );
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
