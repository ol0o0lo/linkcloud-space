import { describe, expect, it, vi } from 'vitest';
import {
  BrowserLocationError,
  getBrowserLocationErrorMessage,
  MAP_GEOLOCATION_OPTIONS,
  requestBrowserMapLocation,
} from './browser-location';

describe('房源地图浏览器定位', () => {
  it('返回当前位置并启用高精度定位', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 22.543096, longitude: 114.057865 },
      } as GeolocationPosition);
    });

    await expect(
      requestBrowserMapLocation({
        getCurrentPosition,
      } as unknown as Geolocation),
    ).resolves.toEqual({ lat: 22.543096, lng: 114.057865 });
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      MAP_GEOLOCATION_OPTIONS,
    );
  });

  it('为不支持、权限拒绝和超时提供明确反馈', async () => {
    await expect(requestBrowserMapLocation()).rejects.toMatchObject({
      reason: 'unsupported',
    });
    expect(
      getBrowserLocationErrorMessage(
        new BrowserLocationError('permission-denied'),
      ),
    ).toContain('定位权限未开启');
    expect(
      getBrowserLocationErrorMessage(new BrowserLocationError('timeout')),
    ).toContain('定位超时');
  });
});
