import { describe, expect, it } from 'vitest';
import {
  getAccountPhoneValidationError,
  normalizeAccountPhoneParts,
  normalizeOptionalAccountPhoneParts,
  parseAccountPhoneParts,
} from './phone';

describe('account phone utilities', () => {
  it('validates and normalizes a mainland phone number', () => {
    expect(normalizeAccountPhoneParts('+86', '138-0013-8000')).toEqual({
      countryCode: '+86',
      nationalNumber: '13800138000',
    });
  });

  it('removes a foreign domestic trunk prefix', () => {
    expect(normalizeAccountPhoneParts('+81', '090-1234-5678')).toEqual({
      countryCode: '+81',
      nationalNumber: '9012345678',
    });
  });

  it('rejects numbers that do not match the selected country code', () => {
    expect(parseAccountPhoneParts('+86', '12025550123')).toBeNull();
    expect(getAccountPhoneValidationError('+86', '12025550123')).toBe(
      '手机号格式不正确，请检查国家区号和号码',
    );
  });

  it('requires an explicit plus sign in the country code', () => {
    expect(parseAccountPhoneParts('86', '13800138000')).toBeNull();
  });

  it('allows both optional account phone fields to remain empty', () => {
    expect(normalizeOptionalAccountPhoneParts('', '')).toEqual({
      countryCode: '',
      nationalNumber: '',
    });
  });
});
