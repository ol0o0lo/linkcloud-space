export type BrowserMapLocation = {
  lat: number;
  lng: number;
};

type BrowserLocationFailureReason =
  | 'unsupported'
  | 'permission-denied'
  | 'unavailable'
  | 'timeout';

export class BrowserLocationError extends Error {
  constructor(readonly reason: BrowserLocationFailureReason) {
    super(reason);
    this.name = 'BrowserLocationError';
  }
}

export const MAP_GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 8000,
  maximumAge: 60000,
};

export function requestBrowserMapLocation(
  geolocation?: Geolocation,
): Promise<BrowserMapLocation> {
  if (!geolocation)
    return Promise.reject(new BrowserLocationError('unsupported'));

  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      (error) => {
        const reason =
          error.code === 1
            ? 'permission-denied'
            : error.code === 3
              ? 'timeout'
              : 'unavailable';
        reject(new BrowserLocationError(reason));
      },
      MAP_GEOLOCATION_OPTIONS,
    );
  });
}

export function getBrowserLocationErrorMessage(error: unknown) {
  if (!(error instanceof BrowserLocationError))
    return '暂时无法获取当前位置，请稍后重试。';
  if (error.reason === 'unsupported')
    return '当前浏览器不支持定位，请检查浏览器设置。';
  if (error.reason === 'permission-denied')
    return '定位权限未开启，请在浏览器设置中允许访问位置。';
  if (error.reason === 'timeout') return '定位超时，请稍后重试。';
  return '暂时无法获取当前位置，请检查系统定位服务。';
}
