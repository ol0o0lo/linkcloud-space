import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetConfig, mockPatchConfig, mockRecords, mockReview } = vi.hoisted(
  () => ({
    mockGetConfig: vi.fn(),
    mockPatchConfig: vi.fn(),
    mockRecords: vi.fn(),
    mockReview: vi.fn(),
  }),
);

vi.mock('@/services/openapi/adminReferrals', () => ({
  appsReferralsApiGetReferralConfig: mockGetConfig,
  appsReferralsApiPatchReferralConfig: mockPatchConfig,
  appsReferralsApiAdminReferralRecords: mockRecords,
  appsReferralsApiReviewReferralRecord: mockReview,
}));

vi.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children, title, subTitle }: any) => (
    <section>
      <h1>{title}</h1>
      <p>{subTitle}</p>
      {children}
    </section>
  ),
  ProTable: ({ actionRef, columns, headerTitle, pagination, request }: any) => {
    const [data, setData] = React.useState<any[]>([]);
    const pageSize = pagination?.defaultPageSize || 10;

    const load = async () => {
      const result = await request?.({ current: 1, pageSize });
      setData(result?.data || []);
    };

    React.useEffect(() => {
      if (actionRef) {
        actionRef.current = { reload: () => void load() };
      }
      void load();
    }, []);

    return (
      <div>
        <h2>{headerTitle}</h2>
        <table>
          <thead>
            <tr>
              {columns.map((column: any) => (
                <th key={column.dataIndex}>{column.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((record, rowIndex) => (
              <tr key={record.id}>
                {columns.map((column: any) => (
                  <td key={column.dataIndex}>
                    {column.render
                      ? column.render(undefined, record, rowIndex)
                      : record[column.dataIndex]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
}));

import ReferralsAdminPage from './index';

describe('ReferralsAdminPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockGetConfig.mockResolvedValue({
      id: 1,
      name: '默认规则',
      trigger_event: 'real_name_verified',
      inviter_reward_amount: 100,
      invitee_reward_amount: 50,
      requires_manual_review: true,
      allow_link: true,
      allow_code: false,
      display_level: 'masked_progress',
    });
    mockRecords.mockResolvedValue({
      items: [
        {
          id: 6,
          inviter_id: 1,
          invitee_id: 2,
          invitee_display: 'bob',
          status: 'pending_review',
          status__mapping: '待审核',
          created_at: '2026-06-16T10:00:00+08:00',
          updated_at: '2026-06-16T10:00:00+08:00',
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    });
    mockPatchConfig.mockResolvedValue({});
    mockReview.mockResolvedValue({});
  });

  it('saves referral config and approves a referral', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ReferralsAdminPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockGetConfig).toHaveBeenCalled();
      expect(mockRecords).toHaveBeenCalledWith({ page: 1, page_size: 10 });
      expect(screen.getByText('bob')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('邀请人奖励（分）'), {
      target: { value: '200' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存规则' }));
    await waitFor(() =>
      expect(mockPatchConfig).toHaveBeenCalledWith(
        expect.objectContaining({ inviter_reward_amount: 200 }),
      ),
    );

    const row = screen.getByText('bob').closest('tr');
    expect(row).not.toBeNull();
    if (!row) {
      throw new Error('邀请记录行未渲染');
    }
    fireEvent.click(within(row).getByText('通过'));
    await waitFor(() =>
      expect(mockReview).toHaveBeenCalledWith(
        { record_id: 6 },
        { approved: true, remark: '' },
      ),
    );
  });
});
