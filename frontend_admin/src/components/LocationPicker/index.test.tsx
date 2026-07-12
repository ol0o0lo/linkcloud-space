import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LocationPicker } from './index';

vi.mock('@/services/manual/amap', () => ({
  useAmap: () => ({ AMap: null, loading: false, error: null, reload: vi.fn() }),
}));

describe('LocationPicker', () => {
  it('仅在确认草稿位置后回填表单值', async () => {
    const onChange = vi.fn();
    render(
      <LocationPicker
        ariaLabel="楼栋位置"
        value={null}
        fallbackLocation={{ address: '科技园路 1 号', lat: 22.54, lng: 113.93 }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '楼栋位置' }));
    fireEvent.click(screen.getByRole('button', { name: /取\s*消/ }));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '楼栋位置' }));
    fireEvent.click(screen.getByRole('button', { name: '确定位置' }));
    expect(onChange).toHaveBeenCalledWith({ address: '科技园路 1 号', lat: 22.54, lng: 113.93 });
  });

  it('仅在没有已有位置或默认位置时请求浏览器定位', async () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } });
    render(<LocationPicker ariaLabel="默认定位" value={null} fallbackLocation={null} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '默认定位' }));
    expect(getCurrentPosition).toHaveBeenCalledOnce();
  });
});
