export type SecurityAction = 'password' | 'phone' | 'email' | 'mfa';

export type SecurityItem = {
  key: SecurityAction;
  title: string;
  description: string;
  actionText: string;
};

export type AuthenticatorSummary = {
  type: string;
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
