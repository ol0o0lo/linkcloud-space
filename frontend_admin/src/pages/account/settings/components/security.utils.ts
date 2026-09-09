import type { AuthenticatorSummary } from './security.types';

export function getAuthenticatorLabel(type: string) {
  switch (type) {
    case 'totp':
      return '动态验证码（TOTP）';
    case 'recovery_codes':
      return '恢复码';
    case 'webauthn':
      return '通行密钥（Passkey）';
    default:
      return type;
  }
}

export function maskPhone(countryCode?: string, nationalNumber?: string) {
  if (!nationalNumber) {
    return '未绑定手机号';
  }

  return `${countryCode || ''}${nationalNumber.slice(0, 3)}****${nationalNumber.slice(-4)}`;
}

export function maskEmail(email?: string) {
  if (!email) {
    return '未绑定邮箱';
  }

  const [name, domain = ''] = email.split('@');
  return `${name.slice(0, 3)}***@${domain}`;
}

export function buildMfaDescription(authenticators: AuthenticatorSummary[]) {
  const types = new Set(authenticators.map((item) => item.type));
  const passkeyCount = authenticators.filter(
    (item) => item.type === 'webauthn',
  ).length;

  if (
    types.has('totp') &&
    types.has('recovery_codes') &&
    passkeyCount === 0 &&
    types.size === 2
  ) {
    return '已启用动态验证码（TOTP）和恢复码';
  }

  if (authenticators.length === 0) {
    return '未启用';
  }

  const parts: string[] = [];
  if (types.has('totp')) {
    parts.push('动态验证码（TOTP）');
  }
  if (types.has('recovery_codes')) {
    parts.push('恢复码');
  }
  if (passkeyCount > 0) {
    parts.push(
      passkeyCount > 1
        ? `${passkeyCount} 个通行密钥（Passkey）`
        : '通行密钥（Passkey）',
    );
  }

  for (const type of types) {
    if (type === 'totp' || type === 'recovery_codes' || type === 'webauthn') {
      continue;
    }
    parts.push(getAuthenticatorLabel(type));
  }

  return parts.length > 0 ? `已启用 ${parts.join('、')}` : '已启用';
}
