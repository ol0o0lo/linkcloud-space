import {
  usersAuthBrowserAccountPhoneUsingPost,
  usersAuthBrowserPhoneVerifyUsingPost,
  usersMeUsingGet,
  usersMeWechatPhoneUsingPost,
  usersUserIdUsingPatch,
} from '@/services/openapi/zhanghu'
import {
  usersMeRealNameLogsUsingGet,
  usersMeRealNameRetryUsingPost,
  usersMeRealNameSubmitUsingPost,
  usersMeRealNameUsingGet,
} from '@/services/openapi/shiming'
import {
  referralsMeRecordsUsingGet,
  referralsMeSummaryUsingGet,
  walletMeLedgerUsingGet,
  walletMeSummaryUsingGet,
  walletMeWithdrawalsUsingGet,
  walletMeWithdrawalsUsingPost,
  walletMeWithdrawalsWithdrawalIdCancelUsingPost,
  walletMeWithdrawalsWithdrawalIdUsingGet,
} from '@/services/openapi/yonghu'
import type { RealNameRetryIn, RealNameSubmitIn, UserPatchIn, WithdrawalIn } from '@/services/openapi/types'
import { chooseAndUploadMedia } from '@/infra/upload/client'

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
  WechatPhoneOut,
  WithdrawalOut,
} from '@/services/openapi/types'

function personalRequestOptions(authRetry: 'safe' | 'never' = 'safe') {
  return { requestScope: { kind: 'personal' as const }, authRetry }
}

export function getCurrentUser() {
  return usersMeUsingGet({ options: personalRequestOptions() })
}

export function updateCurrentUser(userId: number, body: UserPatchIn) {
  return usersUserIdUsingPatch({ params: { user_id: userId }, body, options: personalRequestOptions('never') })
}

export async function uploadPersonalAvatar() {
  const items = await chooseAndUploadMedia({
    scope: { kind: 'personal' },
    resourceType: 'avatar',
    mediaScope: 'user',
    maxCount: 1,
  })
  return items[0]
}

export async function uploadRealNameIdCard() {
  const items = await chooseAndUploadMedia({
    scope: { kind: 'personal' },
    resourceType: 'real_name_id_card',
    mediaScope: 'user',
    maxCount: 1,
  })
  return items[0]
}

export function getRealNameStatus() {
  return usersMeRealNameUsingGet({ options: personalRequestOptions() })
}

export function getRealNameLogs() {
  return usersMeRealNameLogsUsingGet({ options: personalRequestOptions() })
}

export function submitRealName(body: RealNameSubmitIn) {
  return usersMeRealNameSubmitUsingPost({ body, options: personalRequestOptions('never') })
}

export function retryRealName(body: RealNameRetryIn) {
  return usersMeRealNameRetryUsingPost({ body, options: personalRequestOptions('never') })
}

export function getWalletSummary() {
  return walletMeSummaryUsingGet({ options: personalRequestOptions() })
}

export function getWalletLedger(page = 1, pageSize = 20) {
  return walletMeLedgerUsingGet({ params: { page, page_size: pageSize }, options: personalRequestOptions() })
}

export function getWithdrawals(page = 1, pageSize = 20) {
  return walletMeWithdrawalsUsingGet({ params: { page, page_size: pageSize }, options: personalRequestOptions() })
}

export function getWithdrawal(withdrawalId: number) {
  return walletMeWithdrawalsWithdrawalIdUsingGet({ params: { withdrawal_id: withdrawalId }, options: personalRequestOptions() })
}

export function createWithdrawal(body: WithdrawalIn) {
  return walletMeWithdrawalsUsingPost({ body, options: personalRequestOptions('never') })
}

export function cancelWithdrawal(withdrawalId: number) {
  return walletMeWithdrawalsWithdrawalIdCancelUsingPost({ params: { withdrawal_id: withdrawalId }, options: personalRequestOptions('never') })
}

export function getReferralSummary() {
  return referralsMeSummaryUsingGet({ options: personalRequestOptions() })
}

export function getReferralRecords(page = 1, pageSize = 20) {
  return referralsMeRecordsUsingGet({ params: { page, page_size: pageSize }, options: personalRequestOptions() })
}

export function requestPhoneVerification(phoneCountryCode: string, phoneNationalNumber: string) {
  return usersAuthBrowserAccountPhoneUsingPost({
    body: {
      phone_country_code: phoneCountryCode,
      phone_national_number: phoneNationalNumber,
    },
    options: personalRequestOptions('never'),
  })
}

export function confirmPhoneVerification(code: string) {
  return usersAuthBrowserPhoneVerifyUsingPost({
    body: { code },
    options: personalRequestOptions('never'),
  })
}

export function bindWechatPhoneCode(phoneCode: string) {
  return usersMeWechatPhoneUsingPost({
    body: { phone_code: phoneCode },
    options: personalRequestOptions('never'),
  })
}
