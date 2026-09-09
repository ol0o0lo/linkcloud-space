export type { AccountAuthenticator, TotpSetup } from '@/domain/account-security'

export {
  activateTotp,
  createPasskey,
  deleteAuthenticator,
  deletePasskey,
  getWebAuthnSupport,
  isReauthenticationRequired,
  listAuthenticators,
  reauthenticate,
  reauthenticateWithPasskey,
  renamePasskey,
  startTotpSetup,
  viewRecoveryCodes,
} from '@/services/manual/account-security'
