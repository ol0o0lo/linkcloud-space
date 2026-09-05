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

const {
  mockList,
  mockApprove,
  mockReject,
  mockManual,
  mockRevoke,
  mockGet,
  mockUseEnums,
} = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockApprove: vi.fn(),
  mockReject: vi.fn(),
  mockManual: vi.fn(),
  mockRevoke: vi.fn(),
  mockGet: vi.fn(),
  mockUseEnums: vi.fn(),
}));

vi.mock('@/services/openapi/realNameAdmin', () => ({
  appsAccountsApiListAdminRealNameVerifications: mockList,
  appsAccountsApiGetAdminRealNameVerification: mockGet,
  appsAccountsApiApproveAdminRealName: mockApprove,
  appsAccountsApiRejectAdminRealName: mockReject,
  appsAccountsApiMoveAdminRealNameToManualReview: mockManual,
  appsAccountsApiRevokeAdminRealName: mockRevoke,
}));

vi.mock('@/services/manual/enums', () => ({
  enumMapping: (value?: string | null, mapping?: string | null) =>
    mapping || value || '-',
  enumSelectOptions: (
    enumMap: Record<string, { label: string; value: string }[]> | undefined,
    key: string,
  ) => enumMap?.[key] || [],
  useEnums: mockUseEnums,
}));

vi.mock('@ant-design/pro-components', () => ({
  PageContainer: ({ children, title, subTitle }: any) => (
    <section>
      <h1>{title}</h1>
      <p>{subTitle}</p>
      {children}
    </section>
  ),
  ProTable: ({
    actionRef,
    columns,
    headerTitle,
    options,
    pagination,
    request,
    search,
    toolBarRender,
  }: any) => {
    const [data, setData] = React.useState<any[]>([]);
    const pageSize = pagination?.defaultPageSize || 10;

    const load = async (params: Record<string, any> = {}) => {
      const result = await request?.({ current: 1, pageSize, ...params });
      setData(result?.data || []);
    };

    React.useEffect(() => {
      if (actionRef) {
        actionRef.current = { reload: () => void load() };
      }
      void load();
    }, []);

    const keywordConfig = options?.search || search?.search;
    const keywordName = keywordConfig?.name || 'keyword';
    const keywordPlaceholder = keywordConfig?.placeholder;

    return (
      <div>
        {headerTitle ? <h2>{headerTitle}</h2> : null}
        {keywordPlaceholder ? (
          <input
            aria-label={keywordPlaceholder}
            placeholder={keywordPlaceholder}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void load({
                  [keywordName]: (event.currentTarget as HTMLInputElement)
                    .value,
                });
              }
            }}
          />
        ) : null}
        {toolBarRender ? <div>{toolBarRender()}</div> : null}
        <table>
          <thead>
            <tr>
              {columns.map((column: any) => (
                <th
                  key={String(column.key || column.dataIndex || column.title)}
                >
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((record, rowIndex) => (
              <tr key={record.id}>
                {columns.map((column: any) => (
                  <td
                    key={String(column.key || column.dataIndex || column.title)}
                  >
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

import RealNameAdminPage from './index';

describe('RealNameAdminPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockList.mockResolvedValue({
      items: [
        {
          id: 3,
          status: 'manual_review',
          status_label: '旧人工审核',
          status__mapping: '人工复核',
          source: 'user_submit',
          source_label: '旧用户提交',
          source__mapping: '用户提交',
          provider: 'manual',
          provider_label: '旧人工',
          provider__mapping: '人工处理',
          real_name_masked: '张*',
          id_number_masked: '110***********1234',
          is_current: true,
          created_at: '2026-06-16T10:00:00+08:00',
          updated_at: '2026-06-16T10:00:00+08:00',
          user: { username: 'alice', email: 'alice@example.com' },
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
    });
    mockGet.mockResolvedValue({
      id: 3,
      status: 'manual_review',
      status_label: '旧人工审核',
      status__mapping: '人工复核',
      source: 'user_submit',
      source_label: '旧用户提交',
      source__mapping: '用户提交',
      provider: 'manual',
      provider_label: '旧人工',
      provider__mapping: '人工处理',
      real_name_masked: '张*',
      id_number_masked: '110***********1234',
      is_current: true,
      created_at: '2026-06-16T10:00:00+08:00',
      updated_at: '2026-06-16T10:00:00+08:00',
      real_name: '张三',
      id_number: '110101199001011234',
      user: { username: 'alice' },
      id_card_media: [
        {
          media_id: 101,
          media_type: 'image',
          side: 'front',
          url: '/front.png',
        },
        { media_id: 102, media_type: 'image', side: 'back', url: '/back.png' },
      ],
      logs: [
        {
          action: 'move_to_manual_review',
          action_label: '旧转人工',
          action__mapping: '转人工复核',
          created_at: '2026-06-16T10:30:00+08:00',
          note: '补材料',
        },
      ],
    });
    mockApprove.mockResolvedValue({});
    mockReject.mockResolvedValue({});
    mockManual.mockResolvedValue({});
    mockRevoke.mockResolvedValue({});
    mockUseEnums.mockReturnValue({
      data: {
        'accounts.real_name_status': [
          { label: '人工复核', value: 'manual_review' },
          { label: '已实名', value: 'verified' },
        ],
      },
    });
  });

  it('approves a verification and filters by keyword', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <RealNameAdminPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockUseEnums).toHaveBeenCalledWith(['accounts.real_name_status']);
      expect(mockList).toHaveBeenCalledWith({
        page: 1,
        page_size: 10,
        keyword: undefined,
        status: undefined,
      });
      expect(screen.getByText('alice')).toBeInTheDocument();
    });

    const row = screen.getByText('alice').closest('tr');
    if (!(row instanceof HTMLTableRowElement)) {
      throw new Error('Expected alice row to render');
    }
    const rowWithin = within(row);
    fireEvent.click(rowWithin.getByText('通过实名'));
    const approveDialog = screen.getAllByRole('dialog').at(-1);
    if (!(approveDialog instanceof HTMLElement)) {
      throw new Error('Expected approve dialog to render');
    }
    fireEvent.change(within(approveDialog).getByLabelText('备注'), {
      target: { value: 'ok' },
    });
    fireEvent.click(within(approveDialog).getByRole('button', { name: 'OK' }));
    await waitFor(() =>
      expect(mockApprove).toHaveBeenCalledWith(
        { verification_id: 3 },
        { note: 'ok' },
      ),
    );

    const searchBox = screen.getByPlaceholderText(
      '按用户名、邮箱、手机号、实名搜索',
    );
    fireEvent.change(searchBox, { target: { value: 'alice' } });
    fireEvent.keyDown(searchBox, { key: 'Enter', code: 'Enter' });
    await waitFor(() =>
      expect(mockList).toHaveBeenLastCalledWith({
        page: 1,
        page_size: 10,
        keyword: 'alice',
        status: undefined,
      }),
    );
  });
});
