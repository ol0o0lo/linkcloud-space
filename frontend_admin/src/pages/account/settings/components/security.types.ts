export type SecurityAction =
  | 'password'
  | 'phone'
  | 'email'
  | 'mfa'
  | 'real-name';

export type SecurityItem = {
  key: SecurityAction;
  title: string;
  description: string;
  actionText: string;
};

export type AuthenticatorSummary = {
  type: string;
  id?: number;
  name?: string;
  is_passwordless?: boolean;
  created_at?: number;
  last_used_at?: number | null;
};

export type AccountEmail = {
  email: string;
  primary?: boolean;
  verified?: boolean;
};

export type TotpSetup = {
  secret: string;
  totpUrl: string;
};
