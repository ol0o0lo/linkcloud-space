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
  return djangoGet<ReferralConfigRow>('/api/admin/referrals/config/');
}

export async function updateReferralConfigApi(data: Partial<ReferralConfigRow>) {
  return djangoPatch<ReferralConfigRow>('/api/admin/referrals/config/', data);
}

export async function listReferralRecordsApi(params: Record<string, string | number> = {}) {
  return djangoGet<PaginatedResponse<ReferralRecordRow>>('/api/admin/referrals/records/', params);
}

export async function reviewReferralRecordApi(recordId: number, data: { approved: boolean; remark: string }) {
  return djangoPost<ReferralRecordRow>(`/api/admin/referrals/records/${recordId}/review/`, data);
}
