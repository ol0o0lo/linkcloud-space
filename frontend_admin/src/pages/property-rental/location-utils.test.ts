import { describe, expect, it } from 'vitest';
import { formLocation } from './location-utils';

describe('formLocation', () => {
  it('不会将空坐标转化为零坐标', () => {
    expect(formLocation({ address: '科技园路 1 号', lat: null, lng: null })).toBeNull();
  });

  it('接受 API 返回的十进制字符串坐标', () => {
    expect(formLocation({ address: '科技园路 1 号', lat: '22.54', lng: '113.93' })).toEqual({ address: '科技园路 1 号', lat: 22.54, lng: 113.93 });
  });
});
