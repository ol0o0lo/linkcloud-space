import { describe, expect, it } from 'vitest';
import { distanceText, toCoordinates } from '../HouseLocationPoiCard';

describe('house location POI helpers', () => {
  it('validates coordinates and formats POI distance', () => {
    expect(toCoordinates('23.1', '113.3')).toEqual({ lat: 23.1, lng: 113.3 });
    expect(toCoordinates(95, 113.3)).toBeNull();
    expect(distanceText(320)).toBe('320 m');
    expect(distanceText(1280)).toBe('1.3 km');
  });
});
