import type { ProfilePatchInput } from '@/domain/personal-account'
import { buildProfilePatch } from '@/domain/personal-account'
import { updateCurrentUser } from '@/services/manual/account'

export {
  bindWechatPhoneCode,
  cancelWithdrawal,
  confirmPhoneVerification,
  createWithdrawal,
  getCurrentUser,
  getRealNameLogs,
  getRealNameStatus,
  getReferralRecords,
  getReferralSummary,
  getWalletLedger,
  getWalletSummary,
  getWithdrawal,
  getWithdrawals,
  requestPhoneVerification,
  retryRealName,
  submitRealName,
  uploadPersonalAvatar,
  uploadRealNameIdCard,
} from '@/services/manual/account'

export type {
  MediaFileOut,
  MeOut,
  PagedReferralRecordOut,
  PagedWalletLedgerOut,
  PagedWithdrawalOut,
  RealNameLogOut,
  RealNameVerificationOut,
  ReferralRecordOut,
  ReferralSummaryOut,
  UserOut,
  WalletLedgerOut,
  WalletSummaryOut,
  WithdrawalOut,
} from '@/services/manual/account'

export function saveCurrentUserProfile(userId: number, input: ProfilePatchInput) {
  return updateCurrentUser(userId, buildProfilePatch(input))
}
