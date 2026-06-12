export interface WalletBusinessError {
  code: string;
  detail: string;
}

export function unwrapWalletResponse<T>(payload: T | WalletBusinessError): T {
  if (
    payload
    && typeof payload === 'object'
    && 'code' in payload
    && 'detail' in payload
    && typeof payload.code === 'string'
    && typeof payload.detail === 'string'
  ) {
    throw new Error(payload.detail);
  }
  return payload as T;
}
