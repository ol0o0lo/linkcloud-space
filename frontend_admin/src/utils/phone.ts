import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

export type AccountPhoneParts = {
  countryCode: string;
  nationalNumber: string;
};

function cleanPart(value?: string | null) {
  return (value || '').trim();
}

export function parseAccountPhoneParts(
  countryCode?: string | null,
  nationalNumber?: string | null,
): AccountPhoneParts | null {
  const cleanCountryCode = cleanPart(countryCode);
  const cleanNationalNumber = cleanPart(nationalNumber);
  if (!/^\+\d{1,3}$/.test(cleanCountryCode) || !cleanNationalNumber) {
    return null;
  }

  const phoneNumber = parsePhoneNumberFromString(
    `${cleanCountryCode}${cleanNationalNumber}`,
  );
  if (
    !phoneNumber?.isValid() ||
    `+${phoneNumber.countryCallingCode}` !== cleanCountryCode
  ) {
    return null;
  }

  return {
    countryCode: cleanCountryCode,
    nationalNumber: phoneNumber.nationalNumber,
  };
}

export function getAccountPhoneValidationError(
  countryCode?: string | null,
  nationalNumber?: string | null,
  options: { optional?: boolean } = {},
): string | null {
  const cleanCountryCode = cleanPart(countryCode);
  const cleanNationalNumber = cleanPart(nationalNumber);
  if (!cleanCountryCode && !cleanNationalNumber && options.optional) {
    return null;
  }
  if (!cleanCountryCode) {
    return '请选择国家区号';
  }
  if (!cleanNationalNumber) {
    return '请输入手机号';
  }
  if (!parseAccountPhoneParts(cleanCountryCode, cleanNationalNumber)) {
    return '手机号格式不正确，请检查国家区号和号码';
  }
  return null;
}

export function normalizeAccountPhoneParts(
  countryCode?: string | null,
  nationalNumber?: string | null,
): AccountPhoneParts {
  const error = getAccountPhoneValidationError(countryCode, nationalNumber);
  const phoneParts = parseAccountPhoneParts(countryCode, nationalNumber);
  if (error || !phoneParts) {
    throw new Error(error || '手机号格式不正确');
  }
  return phoneParts;
}

export function normalizeOptionalAccountPhoneParts(
  countryCode?: string | null,
  nationalNumber?: string | null,
): AccountPhoneParts {
  if (!cleanPart(countryCode) && !cleanPart(nationalNumber)) {
    return { countryCode: '', nationalNumber: '' };
  }
  return normalizeAccountPhoneParts(countryCode, nationalNumber);
}
