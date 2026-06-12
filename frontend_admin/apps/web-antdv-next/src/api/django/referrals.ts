import { djangoGet, djangoPatch, djangoPost } from './client';

export interface ReferralConfigRow {
  allow_code: boolean;
  allow_link: boolean;
  display_level: string;
  id: number;
  invitee_reward_amount: number;
  inviter_reward_amount: number;
  name: string;
  requires_manual_review: boolean;
  trigger_event: string;
}

export interface ReferralSummaryRow {
  invite_code: string;
  pending_review_count: number;
  registered_count: number;
  rewarded_count: number;
  share_link: string;
}

export interface ReferralRecordRow {
  created_at: string;
  id: number;
  invitee_display: string;
  invitee_id: number;
  inviter_id: number;
  status: string;
  updated_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export async function getReferralConfigApi() {
  return djangoGet<ReferralConfigRow>('/admin/referrals/config/');
}

export async function getMyReferralSummaryApi() {
  return djangoGet<ReferralSummaryRow>('/referrals/me/summary/');
}

export async function listMyReferralRecordsApi(params: Record<string, string | number> = {}) {
  return djangoGet<PaginatedResponse<ReferralRecordRow>>('/referrals/me/records/', params);
}

export async function updateReferralConfigApi(data: Partial<ReferralConfigRow>) {
  return djangoPatch<ReferralConfigRow>('/admin/referrals/config/', data);
}

export async function listReferralRecordsApi(params: Record<string, string | number> = {}) {
  return djangoGet<PaginatedResponse<ReferralRecordRow>>('/admin/referrals/records/', params);
}

export async function reviewReferralRecordApi(recordId: number, data: { approved: boolean; remark: string }) {
  return djangoPost<ReferralRecordRow>(`/admin/referrals/records/${recordId}/review/`, data);
}
