import { request } from '@umijs/max';
import type { LeaseOut, PageResult } from './house';

export type AllocationRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'voided';

export type AccrualEntryType =
  | 'allocation'
  | 'manual_increase'
  | 'manual_decrease'
  | 'reversal';

export type AllocationCapabilities = {
  submit: boolean;
  change_beneficiaries: boolean;
  view_scope: 'self' | 'organization';
  review: boolean;
  adjust: boolean;
  void: boolean;
  signing_teams: Array<{ id: number; name: string }>;
};

export type AllocationBeneficiary = {
  user_id: number;
  name: string;
};

export type AllocationItem = {
  id: number;
  name: string;
  effect: 'increase' | 'decrease';
  effect__mapping: string;
  amount: string;
  sort_order: number;
  remark: string;
};

export type AllocationShare = {
  id: number;
  beneficiary_user_id: number;
  beneficiary_name_snapshot: string;
  weight_bp: number;
  attributed_basis_amount: string;
  allocated_amount: string;
  sort_order: number;
  remark: string;
};

export type LeaseAllocationSourceSnapshot = {
  lease_id?: number;
  house?: {
    id?: number;
    room_number?: string;
    building_id?: number;
    building_name?: string;
    estate_id?: number | null;
    estate_name?: string | null;
  };
  tenant?: { id?: number; name?: string };
  sign_at?: string | null;
  start_date?: string;
  end_date?: string;
  monthly_rent?: string;
  status?: string;
};

export type AllocationRequest = {
  id: number;
  organization_id: number;
  team_id: number | null;
  team_name_snapshot: string;
  rule_source: 'default' | 'organization' | 'team';
  rule_source__mapping: string;
  status: AllocationRequestStatus;
  status__mapping: string;
  basis_amount: string;
  distribution_method: 'percentage' | 'fixed';
  distribution_method__mapping: string;
  distribution_rate_bp: number | null;
  distributable_amount: string;
  currency: string;
  source_snapshot: LeaseAllocationSourceSnapshot;
  submitted_by_id: number;
  submitted_by_name_snapshot: string;
  submitted_at: string;
  expires_at: string;
  reviewed_by_id: number | null;
  reviewed_by_name_snapshot: string;
  reviewed_at: string | null;
  rejection_reason: string;
  voided_by_id: number | null;
  voided_by_name_snapshot: string;
  voided_at: string | null;
  void_reason: string;
  items: AllocationItem[];
  shares: AllocationShare[];
  created_at: string;
  updated_at: string;
};

export type LeaseAllocation = {
  id: number;
  lease: LeaseOut;
  allocation_request: AllocationRequest;
  created_at: string;
};

export type AccrualEntry = {
  id: number;
  organization_id: number;
  beneficiary_user_id: number;
  beneficiary_name_snapshot: string;
  entry_type: AccrualEntryType;
  entry_type__mapping: string;
  amount: string;
  currency: string;
  effective_at: string;
  effective_month: string;
  allocation_share_id: number | null;
  allocation_request_id: number | null;
  reversal_of_id: number | null;
  reversal_entry_id: number | null;
  reason: string;
  created_by_id: number;
  created_by_name: string;
  created_at: string;
  source_snapshot: LeaseAllocationSourceSnapshot | null;
};

export type MonthlyAccrualTotal = {
  beneficiary_user_id: number;
  beneficiary_name_snapshot: string;
  effective_month: string;
  allocation_amount: string;
  manual_increase_amount: string;
  manual_decrease_amount: string;
  reversal_amount: string;
  total_amount: string;
  entry_count: number;
};

type QueryParams = Record<string, unknown>;

export const allocationApi = {
  getCapabilities: () =>
    request<AllocationCapabilities>('/api/allocation/capabilities/'),
  listBeneficiaries: (params?: QueryParams) =>
    request<PageResult<AllocationBeneficiary>>(
      '/api/allocation/beneficiaries/',
      { params },
    ),
  listLeaseAllocations: (params?: QueryParams) =>
    request<PageResult<LeaseAllocation>>('/api/house/lease-allocations/', {
      params,
    }),
  getRequest: (requestId: number) =>
    request<AllocationRequest>(`/api/allocation/requests/${requestId}/`),
  reviewLeaseAllocation: (
    leaseId: number,
    data: { decision: 'approve' | 'reject'; reason?: string },
  ) =>
    request<AllocationRequest>(
      `/api/house/leases/${leaseId}/allocation/review/`,
      { method: 'POST', data },
    ),
  voidLeaseAllocation: (leaseId: number, reason: string) =>
    request<AllocationRequest>(
      `/api/house/leases/${leaseId}/allocation/void/`,
      { method: 'POST', data: { reason } },
    ),
  listEntries: (params?: QueryParams) =>
    request<PageResult<AccrualEntry>>('/api/allocation/entries/', { params }),
  createManualEntry: (data: {
    beneficiary_user_id: number;
    entry_type: 'manual_increase' | 'manual_decrease';
    amount: string;
    effective_month: string;
    reason: string;
  }) =>
    request<AccrualEntry>('/api/allocation/manual-entries/', {
      method: 'POST',
      data,
    }),
  listMonthlyTotals: (params?: QueryParams) =>
    request<PageResult<MonthlyAccrualTotal>>(
      '/api/allocation/monthly-totals/',
      { params },
    ),
};
