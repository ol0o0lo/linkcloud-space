import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocationPicker } from './index';

const { mockUseAmap } = vi.hoisted(() => ({ mockUseAmap: vi.fn() }));

vi.mock('@/services/manual/amap', () => ({
  useAmap: mockUseAmap,
}));

describe('LocationPicker', () => {
  beforeEach(() => {
    mockUseAmap.mockReturnValue({ AMap: null, loading: false, error: null, reload: vi.fn() });
  });

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

  it('允许清除已有的可选定位', () => {
    const onChange = vi.fn();
    render(<LocationPicker ariaLabel="项目位置" value={{ address: '科技园路 1 号', lat: 22.54, lng: 113.93 }} fallbackLocation={null} onChange={onChange} allowClear />);
    fireEvent.click(screen.getByRole('button', { name: '项目位置' }));
    fireEvent.click(screen.getByRole('button', { name: '清除定位' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('弹窗完全打开后初始化并调整地图尺寸', async () => {
    const map = { on: vi.fn(), add: vi.fn(), resize: vi.fn(), destroy: vi.fn() };
    const AMap = {
      Map: vi.fn(function MapMock() { return map; }),
      Geocoder: vi.fn(function GeocoderMock() {}),
      AutoComplete: vi.fn(function AutoCompleteMock() { return { search: vi.fn() }; }),
      Marker: vi.fn(function MarkerMock() { return { setPosition: vi.fn() }; }),
    };
    mockUseAmap.mockReturnValue({ AMap, loading: false, error: null, reload: vi.fn() });
    render(<LocationPicker ariaLabel="楼栋位置" value={null} fallbackLocation={{ address: '科技园路 1 号', lat: 22.54, lng: 113.93 }} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '楼栋位置' }));

    await waitFor(() => expect(AMap.Map).toHaveBeenCalledOnce());
    await waitFor(() => expect(map.resize).toHaveBeenCalledOnce());
    expect(map.on).toHaveBeenCalledWith('click', expect.any(Function));
    expect(map.on).not.toHaveBeenCalledWith('dragend', expect.any(Function));
  });

  it('联想 POI 并在点击候选后选中地图位置', async () => {
    const onChange = vi.fn();
    const marker = { setPosition: vi.fn() };
    const map = { on: vi.fn(), add: vi.fn(), resize: vi.fn(), destroy: vi.fn(), setZoomAndCenter: vi.fn() };
    const autocomplete = {
      search: vi.fn((_keyword, callback) => callback('complete', {
        tips: [{ name: '天河客运站', district: '广东省广州市天河区', address: '燕岭路633号', location: { lat: 23.170997, lng: 113.34213 } }],
      })),
    };
    const geocoder = {
      getAddress: vi.fn((_position, callback) => callback('complete', { regeocode: { formattedAddress: '广东省广州市天河区燕岭路633号天河客运站' } })),
    };
    const AMap = {
      Map: vi.fn(function MapMock() { return map; }),
      Geocoder: vi.fn(function GeocoderMock() { return geocoder; }),
      AutoComplete: vi.fn(function AutoCompleteMock() { return autocomplete; }),
      Marker: vi.fn(function MarkerMock() { return marker; }),
    };
    mockUseAmap.mockReturnValue({ AMap, loading: false, error: null, reload: vi.fn() });
    render(<LocationPicker ariaLabel="楼栋位置" value={null} fallbackLocation={{ address: '科技园路 1 号', lat: 22.54, lng: 113.93 }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: '楼栋位置' }));
    fireEvent.change(screen.getByPlaceholderText('搜索地址、POI、小区或楼栋'), { target: { value: '天河客运站' } });
    fireEvent.click(await screen.findByText(/天河客运站 · 广东省广州市天河区燕岭路633号/));
    fireEvent.click(screen.getByRole('button', { name: '确定位置' }));

    expect(map.setZoomAndCenter).toHaveBeenCalledWith(16, [113.34213, 23.170997]);
    expect(marker.setPosition).toHaveBeenCalledWith([113.34213, 23.170997]);
    expect(onChange).toHaveBeenCalledWith({ address: '广东省广州市天河区燕岭路633号天河客运站', lat: 23.170997, lng: 113.34213 });
  });
});
