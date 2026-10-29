import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AllocationRequest } from '@/services/manual/allocation';
import type { LeaseOut } from '@/services/manual/house';
import AllocationDetailDrawer from './AllocationDetailDrawer';

vi.mock('@/services/manual/allocation', () => ({
  allocationApi: {
    reviewLeaseAllocation: vi.fn(),
    voidLeaseAllocation: vi.fn(),
  },
}));

describe('收益申请历史快照', () => {
  it('纠错后查看旧申请仍展示原租客和原月租', async () => {
    const lease: LeaseOut = {
      can_maintain: true,
      id: 1,
      house_id: 2,
      tenant_id: 3,
      house: {
        is_active: true,

        id: 2,
        label: '101',
        room_number: '101',
        building_id: 4,
        building: {
          id: 4,
          name: '测试楼栋',
          estate_id: null,
          estate: null,
          elevator: false,
          address: '测试地址',
          location: null,
        },
      },
      tenant: { id: 3, name: '纠错后的租客', phone: '13800138000' },
      source_inquiry_id: null,
      registered_by_id: 5,
      deal_team_id: null,
      deal_team_name_snapshot: '',
      performance_month: '2026-02-01',
      source_viewing_record_id: null,
      source_viewing_record: null,
      sign_at: '2026-02-02T04:00:00Z',
      start_date: '2026-02-02',
      end_date: '2027-02-01',
      monthly_rent: '9000.00',
      deposit: null,
      payment_day: 1,
      status: 'active',
      status__mapping: '生效中',
      contract_files: [],
      notes: '',
      extra: {},
    };
    const request: AllocationRequest = {
      id: 6,
      organization_id: 7,
      team_id: null,
      team_name_snapshot: '',
      rule_source: 'organization',
      rule_source__mapping: '空间设置',
      status: 'voided',
      status__mapping: '已作废',
      basis_amount: '3000.00',
      distribution_method: 'percentage',
      distribution_method__mapping: '按比例',
      distribution_rate_bp: 2000,
      distributable_amount: '600.00',
      currency: 'CNY',
      source_snapshot: {
        lease_id: 1,
        tenant: { id: 8, name: '原租客' },
        monthly_rent: '3000.00',
        sign_at: '2026-01-01T04:00:00Z',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
      },
      submitted_by_id: 5,
      submitted_by_name_snapshot: '经纪人',
      submitted_at: '2026-01-02T04:00:00Z',
      expires_at: '2026-01-09T04:00:00Z',
      reviewed_by_id: 9,
      reviewed_by_name_snapshot: '财务',
      reviewed_at: '2026-01-03T04:00:00Z',
      rejection_reason: '',
      voided_by_id: 9,
      voided_by_name_snapshot: '财务',
      voided_at: '2026-02-01T04:00:00Z',
      void_reason: '资料纠错',
      items: [],
      shares: [],
      created_at: '2026-01-02T04:00:00Z',
      updated_at: '2026-02-01T04:00:00Z',
    };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AllocationDetailDrawer
          open
          target={{ lease, request }}
          onChanged={vi.fn()}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('原租客')).toBeInTheDocument();
    expect(screen.queryByText('纠错后的租客')).not.toBeInTheDocument();
    expect(screen.getAllByText(/3,?000/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/9,?000/)).not.toBeInTheDocument();
  });
});
