import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { Button, Form, message } from 'antd';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EarningAttributionFields from '../components/EarningAttributionFields';
import ContactsPage from '../contacts';
import EstatesPage from '../estates';
import HousesPage from '../houses';
import LeasesPage from '../leases';
import ViewingsPage from '../viewings';

declare const __TEST_SUITE_SHARD__: string | undefined;

function registerTestShard(name: string, register: () => void) {
  if (
    typeof __TEST_SUITE_SHARD__ === 'undefined' ||
    __TEST_SUITE_SHARD__ === name
  ) {
    register();
  }
}

const {
  mockCreateBuilding,
  mockCreateEstate,
  mockCreateContact,
  mockCreateDealSigning,
  mockCreateLease,
  mockCreateViewingRecord,
  mockGetBuilding,
  mockGetEstate,
  mockGetContact,
  mockGetHouse,
  mockGetTagSuggestions,
  mockGetLease,
  mockHistoryPush,
  mockInviteLandlord,
  mockListBuildings,
  mockListContacts,
  mockListEstates,
  mockListHouses,
  mockListLeases,
  mockListViewings,
  mockPatchContact,
  mockPatchBuilding,
  mockPatchEstate,
  mockPatchHouse,
  mockPatchLease,
  mockPatchViewingRecord,
  mockDeleteTableColumns,
  mockGetUserSetting,
  mockPutTableColumns,
  mockGetAllocationCapabilities,
  mockListAllocationBeneficiaries,
  mockUseModel,
  mockUseHousePublishRules,
  mockUseTenantWorkspace,
} = vi.hoisted(() => ({
  mockCreateBuilding: vi.fn(),
  mockCreateEstate: vi.fn(),
  mockCreateContact: vi.fn(),
  mockCreateDealSigning: vi.fn(),
  mockCreateLease: vi.fn(),
  mockCreateViewingRecord: vi.fn(),
  mockGetBuilding: vi.fn(),
  mockGetEstate: vi.fn(),
  mockGetContact: vi.fn(),
  mockGetHouse: vi.fn(),
  mockGetTagSuggestions: vi.fn(),
  mockGetLease: vi.fn(),
  mockHistoryPush: vi.fn(),
  mockInviteLandlord: vi.fn(),
  mockListEstates: vi.fn(),
  mockListBuildings: vi.fn(),
  mockListContacts: vi.fn(),
  mockListHouses: vi.fn(),
  mockListViewings: vi.fn(),
  mockListLeases: vi.fn(),
  mockPatchContact: vi.fn(),
  mockPatchBuilding: vi.fn(),
  mockPatchEstate: vi.fn(),
  mockPatchHouse: vi.fn(),
  mockPatchLease: vi.fn(),
  mockPatchViewingRecord: vi.fn(),
  mockDeleteTableColumns: vi.fn(),
  mockGetUserSetting: vi.fn(),
  mockPutTableColumns: vi.fn(),
  mockGetAllocationCapabilities: vi.fn(),
  mockListAllocationBeneficiaries: vi.fn(),
  mockUseModel: vi.fn(),
  mockUseHousePublishRules: vi.fn(),
  mockUseTenantWorkspace: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  history: {
    push: mockHistoryPush,
  },
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useModel: mockUseModel,
}));

vi.mock('@/services/manual/allocation', () => ({
  allocationApi: {
    getCapabilities: mockGetAllocationCapabilities,
    listBeneficiaries: mockListAllocationBeneficiaries,
  },
}));

vi.mock('@/pages/rental/useHousePublishRules', () => ({
  useHousePublishRules: mockUseHousePublishRules,
}));

vi.mock('@/components/AdvancedFilterToolbar', () => ({
  AdvancedFilterToolbar: ({
    actions,
    advancedActive,
    advancedContent,
    children,
    disabled,
    onConfirm,
    onOpenChange,
    onReset,
    open,
    responsiveFilters,
  }: any) => (
    <>
      <div>
        {children}
        {responsiveFilters?.map((item: any) => (
          <React.Fragment key={item.key}>{item.content}</React.Fragment>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onOpenChange?.(true)}
        >
          高级筛选
          {advancedActive && !open ? <span>高级筛选已生效</span> : null}
        </button>
        {actions}
      </div>
      {open ? (
        <div role="dialog" aria-label="高级筛选">
          {advancedContent}
          <button type="button" onClick={onReset}>
            重置
          </button>
          <button type="button" onClick={() => onOpenChange?.(false)}>
            取消
          </button>
          <button
            type="button"
            onClick={async () => {
              await onConfirm();
              onOpenChange?.(false);
            }}
          >
            确定筛选
          </button>
        </div>
      ) : null}
    </>
  ),
}));

vi.mock('@ant-design/pro-components', () => {
  const MockProTable = ({
    columns,
    dataSource = [],
    editable,
    form,
    headerTitle,
    loading,
    locale,
    onChange: onValueChange,
    onTableChange,
    onReset,
    onSubmit,
    options,
    pagination,
    search,
    scroll,
    toolBarRender,
    value,
  }: any) => {
    const resolvedDataSource = value ?? dataSource;
    const tableColumns = columns.filter((column: any) => !column.hideInTable);
    const [sortState, setSortState] = React.useState<
      Record<string, 'ascend' | 'descend'>
    >(() =>
      Object.fromEntries(
        tableColumns
          .filter((column: any) => column.defaultSortOrder)
          .map((column: any) => [
            String(column.key || column.dataIndex),
            column.defaultSortOrder,
          ]),
      ),
    );
    const searchColumns =
      search === false
        ? []
        : columns.filter(
            (column: any) => column.hideInTable && column.search !== false,
          );
    const initialValues = {
      ...(form?.initialValues || {}),
      ...(form?.form?.getFieldsValue?.() || {}),
    };
    const toolbarSearch = options?.search;
    return (
      <div data-scroll-y={scroll?.y} data-testid="mock-pro-table">
        {searchColumns.length ? (
          <form
            onReset={() => onReset?.()}
            onSubmit={(event) => {
              event.preventDefault();
              const values = Object.fromEntries(
                new FormData(event.currentTarget).entries(),
              );
              onSubmit?.(
                Object.fromEntries(
                  Object.entries(values).filter(([, value]) => value !== ''),
                ),
              );
            }}
          >
            {searchColumns.map((column: any) => {
              const name = String(column.dataIndex);
              const fieldProps = column.fieldProps || {};
              const fieldId = `pro-table-search-${name}`;
              const handleChange = (
                event: React.ChangeEvent<HTMLSelectElement>,
              ) =>
                fieldProps.onChange?.(
                  event.target.value
                    ? Number(event.target.value) || event.target.value
                    : undefined,
                );
              return (
                <label htmlFor={fieldId} key={name}>
                  {column.title}
                  {column.valueType === 'select' ? (
                    <select
                      aria-label={column.title}
                      defaultValue={initialValues[name] ?? ''}
                      id={fieldId}
                      name={name}
                      onChange={handleChange}
                    >
                      <option value="" />
                      {(fieldProps.options || []).map((option: any) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      aria-label={column.title}
                      defaultValue={initialValues[name] ?? ''}
                      id={fieldId}
                      name={name}
                      placeholder={fieldProps.placeholder}
                    />
                  )}
                </label>
              );
            })}
            <button type="submit" aria-label="search">
              search
            </button>
            <button type="reset">reset</button>
          </form>
        ) : null}
        {headerTitle ? <h2>{headerTitle}</h2> : null}
        {toolbarSearch ? (
          <input
            aria-label={toolbarSearch.name || 'keyword'}
            defaultValue={toolbarSearch.value ?? ''}
            name={toolbarSearch.name || 'keyword'}
            placeholder={toolbarSearch.placeholder}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                toolbarSearch.onSearch?.(
                  (event.currentTarget as HTMLInputElement).value,
                );
              }
            }}
          />
        ) : null}
        {toolBarRender ? <div>{toolBarRender()}</div> : null}
        {loading ? <span>加载中</span> : null}
        <table>
          <thead>
            <tr>
              {tableColumns.map((column: any) => {
                const columnKey = String(column.key || column.dataIndex);
                const sortOrder = sortState[columnKey];
                return (
                  <th data-sort-order={sortOrder} key={columnKey}>
                    {column.sorter ? (
                      <button
                        type="button"
                        onClick={() => {
                          const nextOrder =
                            sortOrder === 'ascend'
                              ? 'descend'
                              : sortOrder === 'descend'
                                ? undefined
                                : 'ascend';
                          setSortState(
                            nextOrder ? { [columnKey]: nextOrder } : {},
                          );
                          (onTableChange || onValueChange)?.(
                            pagination || {},
                            {},
                            {
                              column,
                              columnKey,
                              field: column.dataIndex,
                              order: nextOrder,
                            },
                            {
                              action: 'sort',
                              currentDataSource: resolvedDataSource,
                            },
                          );
                        }}
                      >
                        {column.title}
                      </button>
                    ) : (
                      column.title
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {resolvedDataSource.map((record: any, rowIndex: number) => {
              const isEditing = editable?.editableKeys?.some(
                (key: React.Key) => String(key) === String(record.id),
              );
              const action = {
                startEditable: (key: React.Key) => {
                  const currentKeys = editable?.editableKeys || [];
                  const nextKeys =
                    editable?.type === 'multiple'
                      ? [
                          ...currentKeys.filter(
                            (currentKey: React.Key) =>
                              String(currentKey) !== String(key),
                          ),
                          key,
                        ]
                      : [key];
                  editable?.onChange?.(nextKeys, record);
                },
              };
              const updateEditableField = (
                editableDataIndex: string,
                nextValue: unknown,
              ) => {
                onValueChange?.(
                  resolvedDataSource.map((item: any) =>
                    item.id === record.id
                      ? {
                          ...item,
                          [editableDataIndex]: nextValue,
                          __editableFieldValues: {
                            ...item.__editableFieldValues,
                            [editableDataIndex]: nextValue,
                          },
                        }
                      : item,
                  ),
                );
              };
              return (
                <tr key={record.id}>
                  {tableColumns.map((column: any) => {
                    const dataIndex = String(column.dataIndex);
                    const editableDataIndex = String(
                      column.key ?? column.dataIndex,
                    );
                    const editableValue = Object.hasOwn(
                      record.__editableFieldValues || {},
                      editableDataIndex,
                    )
                      ? record.__editableFieldValues[editableDataIndex]
                      : record[dataIndex];
                    let content: React.ReactNode;
                    if (isEditing && column.valueType === 'option') {
                      const save = (
                        <button
                          key="save"
                          type="button"
                          onClick={async () => {
                            await editable.onSave?.(record.id, record, record);
                            editable.onChange?.(
                              (editable.editableKeys || []).filter(
                                (key: React.Key) =>
                                  String(key) !== String(record.id),
                              ),
                              record,
                            );
                          }}
                        >
                          保存
                        </button>
                      );
                      const cancel = (
                        <button
                          key="cancel"
                          type="button"
                          onClick={async () => {
                            await editable.onCancel?.(
                              record.id,
                              record,
                              record,
                            );
                            editable.onChange?.(
                              (editable.editableKeys || []).filter(
                                (key: React.Key) =>
                                  String(key) !== String(record.id),
                              ),
                              record,
                            );
                          }}
                        >
                          取消
                        </button>
                      );
                      content = editable.actionRender
                        ? editable.actionRender(record, {}, { save, cancel })
                        : [save, cancel];
                    } else if (
                      isEditing &&
                      column.editable !== false &&
                      column.formItemRender
                    ) {
                      const formNode = column.formItemRender(
                        {},
                        {
                          value: editableValue,
                          onChange: (nextValue: unknown) =>
                            updateEditableField(editableDataIndex, nextValue),
                        },
                        {},
                      );
                      content = React.isValidElement(formNode)
                        ? React.cloneElement(
                            formNode as React.ReactElement<any>,
                            {
                              value: editableValue,
                              onChange: (nextValue: unknown) =>
                                updateEditableField(
                                  editableDataIndex,
                                  (
                                    nextValue as {
                                      target?: { value?: unknown };
                                    }
                                  )?.target?.value ?? nextValue,
                                ),
                            },
                          )
                        : formNode;
                    } else if (
                      isEditing &&
                      column.editable !== false &&
                      column.valueType === 'select' &&
                      column.fieldProps?.mode === 'tags'
                    ) {
                      content = (
                        <input
                          aria-label={column.fieldProps['aria-label']}
                          value={(editableValue || []).join(',')}
                          onChange={(event) =>
                            updateEditableField(
                              editableDataIndex,
                              event.target.value
                                .split(',')
                                .map((tag) => tag.trim())
                                .filter(Boolean),
                            )
                          }
                        />
                      );
                    } else {
                      content = column.render
                        ? editable
                          ? column.render(
                              record[dataIndex],
                              record,
                              rowIndex,
                              action,
                            )
                          : column.render(record[dataIndex], record, rowIndex)
                        : record[dataIndex];
                    }
                    return <td key={dataIndex}>{content}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && !resolvedDataSource.length ? (
          <div>{locale?.emptyText || '暂无数据'}</div>
        ) : null}
        {pagination ? (
          <nav>
            {pagination.showSizeChanger ? (
              <label>
                每页条数
                <select
                  aria-label="每页条数"
                  disabled={pagination.disabled}
                  value={pagination.pageSize}
                  onChange={(event) =>
                    pagination.onChange?.(1, Number(event.target.value))
                  }
                >
                  {pagination.pageSizeOptions.map((pageSize: number) => (
                    <option key={pageSize} value={pageSize}>
                      {pageSize}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button
              type="button"
              disabled={(pagination.current || 1) <= 1}
              onClick={() =>
                pagination.onChange?.(
                  (pagination.current || 1) - 1,
                  pagination.pageSize,
                )
              }
            >
              上一页
            </button>
            <span>{pagination.current || 1}</span>
            <button
              type="button"
              disabled={
                (pagination.current || 1) * (pagination.pageSize || 10) >=
                (pagination.total || 0)
              }
              onClick={() =>
                pagination.onChange?.(
                  (pagination.current || 1) + 1,
                  pagination.pageSize,
                )
              }
            >
              下一页
            </button>
          </nav>
        ) : null}
      </div>
    );
  };

  return {
    EditableProTable: MockProTable,
    ListToolBar: ({
      actions,
      title,
    }: {
      actions?: React.ReactNode[];
      title?: React.ReactNode;
    }) => (
      <div>
        {title}
        <div>{actions}</div>
      </div>
    ),
    ProTable: MockProTable,
  };
});

vi.mock('@/pages/space/shared', () => ({
  TenantSelectionGuard: ({
    children,
    extra,
  }: {
    children: React.ReactNode;
    extra?: React.ReactNode;
  }) => (
    <div>
      {extra}
      {children}
    </div>
  ),
  useTenantWorkspace: mockUseTenantWorkspace,
}));

vi.mock('@/components/EntityPreview', () => {
  const preview =
    (type: string) =>
    ({ id, children }: { id?: number | null; children: React.ReactNode }) => (
      <span data-preview={type} data-id={id}>
        {children}
      </span>
    );
  return {
    BuildingPreview: preview('building'),
    ContactPreview: preview('contact'),
    EntityPreviewDetailDrawer: () => null,
    EstatePreview: preview('estate'),
    HousePreview: preview('house'),
    LeasePreview: preview('lease'),
    ViewingPreview: preview('viewing'),
  };
});

vi.mock('@/components/LocationPicker', () => ({
  LocationPicker: ({
    ariaLabel,
    onChange,
    allowClear,
  }: {
    ariaLabel: string;
    onChange: (value: unknown) => void;
    allowClear?: boolean;
  }) => (
    <span>
      <button
        type="button"
        onClick={() =>
          onChange({
            address: `${ariaLabel}地图地址`,
            lat: 22.54321,
            lng: 113.98765,
          })
        }
      >
        {ariaLabel}
      </button>
      {allowClear ? (
        <button
          type="button"
          onClick={() => onChange(null)}
        >{`清除${ariaLabel}`}</button>
      ) : null}
    </span>
  ),
}));

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    createBuilding: mockCreateBuilding,
    createEstate: mockCreateEstate,
    createContact: mockCreateContact,
    createDealSigning: mockCreateDealSigning,
    createLease: mockCreateLease,
    createViewingRecord: mockCreateViewingRecord,
    getBuilding: mockGetBuilding,
    getEstate: mockGetEstate,
    getContact: mockGetContact,
    getHouse: mockGetHouse,
    getTagSuggestions: mockGetTagSuggestions,
    getLease: mockGetLease,
    inviteLandlord: mockInviteLandlord,
    listEstates: mockListEstates,
    listBuildings: mockListBuildings,
    listContacts: mockListContacts,
    listHouses: mockListHouses,
    listViewingRecords: mockListViewings,
    listLeases: mockListLeases,
    patchContact: mockPatchContact,
    patchBuilding: mockPatchBuilding,
    patchEstate: mockPatchEstate,
    patchHouse: mockPatchHouse,
    patchLease: mockPatchLease,
    patchViewingRecord: mockPatchViewingRecord,
  },
}));

vi.mock('@/services/openapi/userSettings', () => ({
  appsSettingsApiDeleteUserTableColumnsView: mockDeleteTableColumns,
  appsSettingsApiGetUserSettingView: mockGetUserSetting,
  appsSettingsApiPutUserTableColumns: mockPutTableColumns,
}));

const enumData = {
  'house.contact_role': [
    { label: '房东', value: 'landlord' },
    { label: '租客', value: 'tenant' },
  ],
  'house.estate_property_type': [{ label: '住宅', value: 'residential' }],
  'house.house_status': [
    { label: '空置', value: 'vacant' },
    { label: '招租', value: 'listed' },
    { label: '已租', value: 'rented' },
    { label: '装修', value: 'renovating' },
    { label: '已停用', value: 'inactive' },
  ],
  'house.viewing_record_status': [
    { label: '已预约', value: 'scheduled' },
    { label: '已带看', value: 'viewed' },
    { label: '已成交', value: 'converted' },
    { label: '已取消', value: 'canceled' },
    { label: '爽约', value: 'no_show' },
  ],
  'house.lease_status': [
    { label: '待生效', value: 'pending' },
    { label: '生效中', value: 'active' },
    { label: '已到期', value: 'expired' },
    { label: '已终止', value: 'terminated' },
  ],
};

vi.mock('@/services/manual/enums', () => ({
  enumMapping: (value?: string | null, mapping?: string | null) =>
    mapping || value || '-',
  enumOptionMapping: (
    enumMap: typeof enumData | undefined,
    key: keyof typeof enumData,
    value?: string | null,
  ) =>
    value
      ? enumMap?.[key]?.find((item) => item.value === value)?.label || value
      : '-',
  enumSelectOptions: (
    enumMap: typeof enumData | undefined,
    key: keyof typeof enumData,
  ) => enumMap?.[key] || [],
  useEnums: () => ({ data: enumData }),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: 0, retry: false },
    },
  });

const renderPage = (node: React.ReactNode) =>
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      {node}
    </QueryClientProvider>,
  );

const EarningAttributionHarness = () => {
  const [form] = Form.useForm<{ beneficiary_user_ids?: number[] }>();
  return (
    <Form form={form}>
      <EarningAttributionFields enabled form={form} />
      <Button htmlType="submit">提交收益归属</Button>
    </Form>
  );
};

const switchToBuildingList = () =>
  fireEvent.click(screen.getByRole('radio', { name: '楼栋列表' }));

const defaultEstate = { id: 1, name: 'xinghewan', display_name: '星河湾花园' };
const defaultBuilding = {
  id: 2,
  estate_id: 1,
  estate: defaultEstate,
  name: '1 栋',
  floors: 32,
  elevator: true,
};
const defaultLandlord = { id: 3, name: '张房东', phone: '13800000000' };
const defaultTenant = { id: 6, name: '王租客', phone: '13700000000' };

function buildingItem(overrides: Record<string, any> = {}) {
  const { estate_display_name, ...rest } = overrides;
  const estateId = Object.hasOwn(overrides, 'estate_id')
    ? overrides.estate_id
    : defaultEstate.id;
  const estate = Object.hasOwn(overrides, 'estate')
    ? overrides.estate
    : estateId == null
      ? null
      : {
          id: estateId,
          name: estate_display_name || defaultEstate.name,
          display_name: estate_display_name || defaultEstate.display_name,
        };
  return {
    id: 2,
    estate_id: estate?.id ?? estateId,
    estate,
    name: '1 栋',
    floors: 32,
    elevator: true,
    ...rest,
  };
}

function houseItem(overrides: Record<string, any> = {}) {
  const building = overrides.building || defaultBuilding;
  const roomNumber = overrides.room_number || 'A-101';
  return {
    id: 99,
    building_id: building.id,
    building,
    landlord_id: defaultLandlord.id,
    landlord: defaultLandlord,
    room_number: roomNumber,
    label: `${building.estate.display_name || building.estate.name} / ${building.name} / ${roomNumber}`,
    ...overrides,
  };
}

function viewingItem(overrides: Record<string, any> = {}) {
  const house = overrides.house || houseItem();
  const contact = Object.hasOwn(overrides, 'contact')
    ? overrides.contact
    : null;
  const contactId = Object.hasOwn(overrides, 'contact_id')
    ? overrides.contact_id
    : contact?.id || null;
  return {
    id: 4,
    house_id: house.id,
    house,
    contact_id: contactId,
    contact,
    customer_name: '李客户',
    customer_phone: '13900000000',
    scheduled_at: '2026-07-01T10:00:00+08:00',
    status: 'scheduled',
    ...overrides,
  };
}

function leaseItem(overrides: Record<string, any> = {}) {
  const house = overrides.house || houseItem();
  const tenant = overrides.tenant || defaultTenant;
  return {
    id: 5,
    house_id: house.id,
    house,
    tenant_id: tenant.id,
    tenant,
    start_date: '2026-07-01',
    end_date: '2027-06-30',
    monthly_rent: '4200.00',
    status: 'active',
    contract_files: [],
    ...overrides,
  };
}

describe('Property rental domain list pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockUseTenantWorkspace.mockReturnValue({
      selectedOrgSlug: 'org',
      queryClient: createTestQueryClient(),
    });
    mockUseModel.mockReturnValue({
      initialState: {
        currentUser: {
          id: 101,
          username: 'current-user',
          first_name: '当前',
          last_name: '用户',
        },
      },
    });
    mockGetAllocationCapabilities.mockResolvedValue({
      submit: true,
      change_beneficiaries: false,
      view_scope: 'self',
      review: false,
      adjust: false,
      void: false,
      signing_teams: [],
    });
    mockListAllocationBeneficiaries.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 100,
    });
    mockUseHousePublishRules.mockReturnValue({
      rules: {},
      isPending: false,
    });
    mockGetUserSetting.mockRejectedValue({ response: { status: 404 } });
    mockPutTableColumns.mockResolvedValue({});
    mockDeleteTableColumns.mockResolvedValue({});
    window.history.pushState({}, '', '/');
    mockListEstates.mockResolvedValue({
      items: [
        {
          id: 1,
          name: '星河湾',
          city: '深圳',
          district: '南山',
          address: '科技路',
          building_count: 0,
        },
      ],
      total: 1,
      page: 1,
      page_size: 100,
    });
    mockListBuildings.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 100,
    });
    mockListContacts.mockResolvedValue({
      items: [
        { id: 3, name: '张房东', phone: '13800000000', roles: ['landlord'] },
      ],
      total: 1,
      page: 1,
      page_size: 100,
    });
    mockListHouses.mockResolvedValue({
      items: [houseItem()],
      total: 1,
      page: 1,
      page_size: 100,
    });
    mockListViewings.mockResolvedValue({
      items: [viewingItem()],
      total: 1,
      page: 1,
      page_size: 100,
    });
    mockListLeases.mockResolvedValue({
      items: [leaseItem()],
      total: 1,
      page: 1,
      page_size: 100,
    });
    mockInviteLandlord.mockResolvedValue({
      organization_name: '甲中介',
      contact_name: '张房东',
      invitee_phone_masked: '+86****0000',
      expires_at: '2026-09-01T12:00:00+08:00',
      action_url:
        'https://example.com/dashboard/landlord-invitations/test-token',
    });
    mockCreateBuilding.mockResolvedValue({
      id: 7,
      estate_id: 1,
      name: '2 栋',
      floors: 28,
      elevator: false,
      address: '',
    });
    mockCreateEstate.mockResolvedValue({
      id: 9,
      name: '新项目',
      display_name: '新项目',
    });
    mockCreateContact.mockResolvedValue({
      id: 8,
      name: '王租客',
      phone: '13700000000',
      roles: ['tenant'],
    });
    mockCreateLease.mockResolvedValue({
      id: 10,
      house_id: 99,
      tenant_id: 6,
      status: 'pending',
    });
    mockCreateDealSigning.mockResolvedValue({
      id: 11,
      lease: leaseItem({ id: 11, status: 'active' }),
      allocation_request: { id: 21, status: 'pending' },
      created_at: '2026-07-01T10:00:00+08:00',
    });
    mockCreateViewingRecord.mockResolvedValue({
      id: 9,
      house_id: 99,
      customer_name: '赵客户',
      customer_phone: '13600000000',
      scheduled_at: '2026-07-02T10:00:00+08:00',
      status: 'scheduled',
    });
    mockGetBuilding.mockResolvedValue(defaultBuilding);
    mockGetEstate.mockResolvedValue(defaultEstate);
    mockGetContact.mockResolvedValue({
      id: 3,
      name: '张房东',
      phone: '13800000000',
      email: 'landlord@example.com',
      roles: ['landlord'],
      is_active: true,
    });
    mockGetHouse.mockResolvedValue(houseItem());
    mockGetTagSuggestions.mockResolvedValue({ tags: ['近地铁', '拎包入住'] });
    mockGetLease.mockResolvedValue(leaseItem());
    mockPatchContact.mockResolvedValue({
      id: 3,
      name: '张房东',
      phone: '13800000000',
      roles: ['landlord'],
      is_active: true,
    });
    mockPatchBuilding.mockResolvedValue(defaultBuilding);
    mockPatchEstate.mockResolvedValue(defaultEstate);
    mockPatchLease.mockResolvedValue({ id: 5, status: 'expired' });
    mockPatchViewingRecord.mockResolvedValue({
      id: 4,
      house_id: 99,
      customer_name: '李客户',
      customer_phone: '13900000000',
      scheduled_at: '2026-07-01T10:00:00+08:00',
      status: 'viewed',
    });
  });

  afterEach(() => {
    message.destroy();
    window.history.pushState({}, '', '/');
  });

  registerTestShard('rental-estates', () => {
    it('creates an estate with the confirmed map coordinates', async () => {
      renderPage(<EstatesPage />);
      fireEvent.click(
        await screen.findByRole('button', { name: 'plus 新建项目' }),
      );
      fireEvent.change(screen.getByLabelText('项目名称'), {
        target: { value: '新项目' },
      });
      fireEvent.change(screen.getByLabelText('省份'), {
        target: { value: '广东省' },
      });
      fireEvent.change(screen.getByLabelText('城市'), {
        target: { value: '深圳市' },
      });
      fireEvent.change(screen.getByLabelText('区域'), {
        target: { value: '南山区' },
      });
      fireEvent.click(screen.getByRole('button', { name: '项目位置' }));
      fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));
      await waitFor(() =>
        expect(mockCreateEstate).toHaveBeenCalledWith(
          expect.objectContaining({
            address: '项目位置地图地址',
            lat: 22.54321,
            lng: 113.98765,
          }),
        ),
      );
    });

    it('updates an estate with the confirmed map coordinates', async () => {
      mockListEstates.mockResolvedValue({
        items: [
          {
            ...defaultEstate,
            property_type: 'residential',
            province: '广东省',
            city: '深圳市',
            district: '南山区',
            address: '旧项目地址',
            lat: 22.5,
            lng: 113.9,
            is_active: true,
          },
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });
      renderPage(<EstatesPage />);
      fireEvent.click(
        (await screen.findAllByRole('button', { name: '编辑' }))[0],
      );
      fireEvent.click(screen.getByRole('button', { name: '项目位置' }));
      fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));
      await waitFor(() =>
        expect(mockPatchEstate).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            address: '项目位置地图地址',
            lat: 22.54321,
            lng: 113.98765,
          }),
        ),
      );
    });

    it('starts building creation from an estate row and preselects that estate', async () => {
      mockListEstates.mockResolvedValue({
        items: [
          {
            id: 1,
            name: 'xinghewan',
            display_name: '星河湾花园',
            city: '深圳',
            district: '南山',
            address: '科技路',
            lat: 22.54,
            lng: 113.93,
          },
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<EstatesPage />);

      const estateRow = (await screen.findAllByText('星河湾花园'))[0].closest(
        'tr',
      );
      expect(estateRow).not.toBeNull();
      fireEvent.click(
        within(estateRow as HTMLTableRowElement).getByRole('button', {
          name: '新建楼栋',
        }),
      );
      expect(screen.getByText('楼栋图片')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('楼栋名'), {
        target: { value: '2 栋' },
      });
      fireEvent.change(screen.getByLabelText('楼层'), {
        target: { value: '28' },
      });
      fireEvent.change(screen.getByLabelText('地址'), {
        target: { value: '科技路 2 栋' },
      });
      fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

      await waitFor(() =>
        expect(mockCreateBuilding).toHaveBeenCalledWith(
          expect.objectContaining({
            estate_id: 1,
            name: '2 栋',
            floors: 28,
            lat: 22.54,
            lng: 113.93,
          }),
        ),
      );
    });

    it('updates a building with the confirmed map coordinates', async () => {
      mockListHouses.mockResolvedValue({
        items: [houseItem()],
        total: 37,
        page: 1,
        page_size: 1,
      });
      mockListBuildings.mockResolvedValue({
        items: [
          buildingItem({
            address: '旧楼栋地址',
            lat: 22.5,
            lng: 113.9,
            is_active: true,
          }),
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });
      renderPage(<EstatesPage />);
      switchToBuildingList();
      fireEvent.click(
        (await screen.findAllByRole('button', { name: '编辑' }))[0],
      );
      fireEvent.click(screen.getByRole('button', { name: '楼栋位置' }));
      fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

      expect(mockPatchBuilding).not.toHaveBeenCalled();
      expect(
        await screen.findByText(
          '保存后，将同步更新“1 栋”下 37 套房源的楼栋信息。',
        ),
      ).toBeInTheDocument();
      expect(mockListHouses).toHaveBeenCalledWith({
        building_id: 2,
        page: 1,
        page_size: 1,
      });
      fireEvent.click(screen.getByRole('button', { name: '确认保存' }));

      await waitFor(() =>
        expect(mockPatchBuilding).toHaveBeenCalledWith(
          2,
          expect.objectContaining({
            address: '楼栋位置地图地址',
            lat: 22.54321,
            lng: 113.98765,
          }),
        ),
      );
    });

    it('clears building coordinates without clearing its required address', async () => {
      mockListBuildings.mockResolvedValue({
        items: [
          buildingItem({
            address: '保留的楼栋地址',
            lat: 22.5,
            lng: 113.9,
            is_active: true,
          }),
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });
      renderPage(<EstatesPage />);
      switchToBuildingList();
      fireEvent.click(
        (await screen.findAllByRole('button', { name: '编辑' }))[0],
      );
      fireEvent.click(screen.getByRole('button', { name: '清除楼栋位置' }));
      fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

      expect(mockPatchBuilding).not.toHaveBeenCalled();
      expect(
        await screen.findByText(
          '保存后，将同步更新“1 栋”下 1 套房源的楼栋信息。',
        ),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '确认保存' }));

      await waitFor(() =>
        expect(mockPatchBuilding).toHaveBeenCalledWith(
          2,
          expect.objectContaining({
            address: '保留的楼栋地址',
            lat: null,
            lng: null,
          }),
        ),
      );
    });

    it('requires secondary confirmation before saving building changes', async () => {
      mockListBuildings.mockResolvedValue({
        items: [
          buildingItem({
            address: '原楼栋地址',
            is_active: true,
          }),
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });
      renderPage(<EstatesPage />);
      switchToBuildingList();
      fireEvent.click(
        (await screen.findAllByRole('button', { name: '编辑' }))[0],
      );
      fireEvent.change(screen.getByLabelText('楼栋名'), {
        target: { value: '修改后楼栋名' },
      });
      fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

      expect(
        await screen.findByText(
          '保存后，将同步更新“1 栋”下 1 套房源的楼栋信息。',
        ),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '返回检查' }));

      expect(mockPatchBuilding).not.toHaveBeenCalled();
      expect(screen.getByLabelText('楼栋名')).toHaveValue('修改后楼栋名');
      await waitFor(() =>
        expect(
          screen.queryByRole('dialog', { name: '确认修改楼栋信息' }),
        ).not.toBeInTheDocument(),
      );
    });

    it('filters buildings by estate_id from the URL and clears the estate filter', async () => {
      mockListEstates.mockResolvedValue({
        items: [defaultEstate],
        total: 1,
        page: 1,
        page_size: 100,
      });
      window.history.pushState(
        {},
        '',
        '/rental/properties/estates?view=buildings&estate_id=1',
      );

      renderPage(<EstatesPage />);

      await waitFor(() =>
        expect(mockListBuildings).toHaveBeenCalledWith({
          estate_id: 1,
          page: 1,
          page_size: 20,
          keyword: undefined,
        }),
      );
      expect(
        await screen.findByText('当前项目：星河湾花园'),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '清除小区筛选' }));

      await waitFor(() =>
        expect(window.location.search).not.toContain('estate_id'),
      );
      await waitFor(() =>
        expect(mockListBuildings).toHaveBeenCalledWith({
          page: 1,
          page_size: 20,
          keyword: undefined,
        }),
      );
    });

    it('keeps the estate filter when opening the pending-location task', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/properties/estates?view=buildings&task=building_location&estate_id=1',
      );
      mockListBuildings.mockResolvedValue({
        items: [
          buildingItem({
            id: 2,
            estate_id: 1,
            name: '当前项目待定位楼栋',
            lat: null,
            lng: null,
          }),
          buildingItem({
            id: 3,
            estate_id: 2,
            estate_display_name: '其他项目',
            name: '其他项目待定位楼栋',
            lat: null,
            lng: null,
          }),
        ],
        total: 2,
        page: 1,
        page_size: 500,
      });

      renderPage(<EstatesPage />);

      expect(await screen.findByText('当前项目待定位楼栋')).toBeInTheDocument();
      expect(screen.queryByText('其他项目待定位楼栋')).not.toBeInTheDocument();
    });

    it('shows associated buildings only while editing an estate that has buildings', async () => {
      mockListEstates.mockResolvedValue({
        items: [
          {
            id: 1,
            name: 'xinghewan',
            display_name: '星河湾花园',
            city: '深圳',
            district: '南山',
            address: '科技路',
          },
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });
      mockListBuildings.mockResolvedValue({
        items: [buildingItem({ id: 2, name: '1 栋' })],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<EstatesPage />);

      fireEvent.click(
        (
          await screen.findAllByRole(
            'button',
            { name: '编辑' },
            { timeout: 5_000 },
          )
        )[0],
      );
      expect(await screen.findByText('关联楼栋')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: '查看全部楼栋' }),
      ).toHaveAttribute(
        'href',
        '/dashboard/rental/properties/estates?view=buildings&estate_id=1',
      );
    });

    it('shows estate-associated buildings from the estate query when the current keyword does not match', async () => {
      mockListEstates.mockResolvedValue({
        items: [
          {
            id: 1,
            name: 'xinghewan',
            display_name: '星河湾花园',
            city: '深圳',
            district: '南山',
            address: '科技路',
          },
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });
      mockListBuildings.mockImplementation((params?: Record<string, unknown>) =>
        Promise.resolve({
          items:
            params?.estate_id === 1
              ? [buildingItem({ id: 2, name: '1 栋' })]
              : [],
          total: params?.estate_id === 1 ? 1 : 0,
          page: 1,
          page_size: Number(params?.page_size || 20),
        }),
      );
      window.history.pushState(
        {},
        '',
        '/rental/properties/estates?keyword=%E4%B8%8D%E5%8C%B9%E9%85%8D',
      );

      renderPage(<EstatesPage />);

      fireEvent.click(
        (
          await screen.findAllByRole(
            'button',
            { name: '编辑' },
            { timeout: 5_000 },
          )
        )[0],
      );

      expect(await screen.findByText('关联楼栋')).toBeInTheDocument();
      expect(screen.getByText('1 栋')).toBeInTheDocument();
      await waitFor(() =>
        expect(mockListBuildings).toHaveBeenCalledWith({
          estate_id: 1,
          page: 1,
          page_size: 5,
        }),
      );
    });

    it('hides the associated buildings card when the estate query has no buildings', async () => {
      mockListEstates.mockResolvedValue({
        items: [
          {
            id: 1,
            name: 'xinghewan',
            display_name: '星河湾花园',
            city: '深圳',
            district: '南山',
            address: '科技路',
          },
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });
      mockListBuildings.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        page_size: 5,
      });

      renderPage(<EstatesPage />);

      fireEvent.click(
        (
          await screen.findAllByRole(
            'button',
            { name: '编辑' },
            { timeout: 5_000 },
          )
        )[0],
      );

      await waitFor(() =>
        expect(mockListBuildings).toHaveBeenCalledWith({
          estate_id: 1,
          page: 1,
          page_size: 5,
        }),
      );
      expect(screen.queryByText('关联楼栋')).not.toBeInTheDocument();
    });

    it('links active buildings directly to house registration', async () => {
      mockListEstates.mockResolvedValue({
        items: [
          {
            id: 1,
            name: 'xinghewan',
            display_name: '星河湾花园',
            city: '深圳',
            district: '南山',
            address: '科技路',
          },
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });
      mockListBuildings.mockResolvedValue({
        items: [
          buildingItem({
            id: 2,
            estate_id: 1,
            estate_display_name: '星河湾花园',
            name: '1 栋',
            floors: 32,
            elevator: true,
            is_active: true,
          }),
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<EstatesPage />);

      switchToBuildingList();

      expect(
        await screen.findByRole('link', { name: '登记房源' }),
      ).toHaveAttribute(
        'href',
        '/dashboard/rental/properties/new?building_id=2',
      );
    });

    it('scopes estate overview when searching by keyword', async () => {
      mockListEstates.mockImplementation((params?: Record<string, unknown>) => {
        if (params?.keyword === '旧改') {
          return Promise.resolve({
            items: [
              {
                id: 2,
                name: 'legacy-estate',
                display_name: '旧改公寓',
                city: '上海',
                district: '浦东',
                address: '张杨路 1 号',
                is_active: true,
                property_type: 'apartment',
                province: '上海',
              },
            ],
            total: 1,
            page: 1,
            page_size: Number(params?.page_size || 20),
          });
        }
        return Promise.resolve({
          items: [
            {
              id: 1,
              name: 'default-estate',
              display_name: '默认项目',
              city: '默认',
              district: '默认',
              address: '默认',
              is_active: true,
              property_type: 'residential',
              province: '默认',
            },
            {
              id: 2,
              name: 'legacy-estate',
              display_name: '旧改公寓',
              city: '上海',
              district: '浦东',
              address: '张杨路 1 号',
              is_active: true,
              property_type: 'apartment',
              province: '上海',
            },
            {
              id: 3,
              name: 'archive-estate',
              display_name: '停用项目',
              city: '上海',
              district: '徐汇',
              address: '',
              is_active: false,
              property_type: 'office',
              province: '上海',
            },
          ],
          total: 3,
          page: 1,
          page_size: Number(params?.page_size || 20),
        });
      });
      mockListBuildings.mockImplementation(
        (params?: Record<string, unknown>) => {
          if (params?.keyword === '旧改') {
            return Promise.resolve({
              items: [
                buildingItem({
                  id: 3,
                  estate_id: 2,
                  estate_display_name: '旧改公寓',
                  name: '2 栋',
                  floors: 18,
                  elevator: true,
                  address: '张杨路 1 号',
                  is_active: true,
                }),
              ],
              total: 1,
              page: 1,
              page_size: Number(params?.page_size || 20),
            });
          }
          return Promise.resolve({
            items: [
              buildingItem({
                id: 1,
                estate_id: 1,
                estate_display_name: '默认项目',
                name: '1 栋',
                floors: 30,
                elevator: true,
                address: '默认',
                is_active: true,
              }),
              buildingItem({
                id: 3,
                estate_id: 2,
                estate_display_name: '旧改公寓',
                name: '2 栋',
                floors: 18,
                elevator: true,
                address: '张杨路 1 号',
                is_active: true,
              }),
              buildingItem({
                id: 4,
                estate_id: 3,
                estate_display_name: '停用项目',
                name: '老楼栋',
                floors: 6,
                elevator: false,
                address: '',
                is_active: false,
              }),
            ],
            total: 3,
            page: 1,
            page_size: Number(params?.page_size || 20),
          });
        },
      );

      renderPage(<EstatesPage />);

      fireEvent.change(screen.getByPlaceholderText('搜索项目 / 楼栋'), {
        target: { value: '旧改' },
      });
      fireEvent.keyDown(screen.getByPlaceholderText('搜索项目 / 楼栋'), {
        key: 'Enter',
        code: 'Enter',
      });

      expect((await screen.findAllByText('项目列表')).length).toBeGreaterThan(
        0,
      );
      expect(screen.queryByText('当前筛选概览')).not.toBeInTheDocument();
      expect(
        screen.queryByText('当前只看：搜索：旧改'),
      ).not.toBeInTheDocument();
      expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
      await waitFor(() =>
        expect(mockListEstates).toHaveBeenCalledWith(
          expect.objectContaining({ keyword: '旧改' }),
        ),
      );
      await waitFor(() =>
        expect(mockListBuildings).toHaveBeenCalledWith(
          expect.objectContaining({ keyword: '旧改' }),
        ),
      );
    });

    it('restores estate search state from URL', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/properties/estates?keyword=%E6%97%A7%E6%94%B9&view=buildings&estate_page=2&building_page=3',
      );

      renderPage(<EstatesPage />);

      expect(await screen.findByDisplayValue('旧改')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'plus 新建项目' }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('radio', { name: '楼栋列表' }),
      ).toBeInTheDocument();
      await waitFor(() =>
        expect(mockListEstates).toHaveBeenCalledWith(
          expect.objectContaining({ page: 2, keyword: '旧改' }),
        ),
      );
      await waitFor(() =>
        expect(mockListBuildings).toHaveBeenCalledWith(
          expect.objectContaining({ page: 3, keyword: '旧改' }),
        ),
      );
    });

    it('syncs estate search state back to URL', async () => {
      renderPage(<EstatesPage />);

      fireEvent.change(screen.getByPlaceholderText('搜索项目 / 楼栋'), {
        target: { value: '旧改' },
      });
      fireEvent.keyDown(screen.getByPlaceholderText('搜索项目 / 楼栋'), {
        key: 'Enter',
        code: 'Enter',
      });

      await waitFor(() =>
        expect(window.location.search).toBe('?keyword=%E6%97%A7%E6%94%B9'),
      );
    });

    it('loads every building for estate coverage without inheriting the current keyword or estate filter', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/properties/estates?keyword=%E7%AD%9B%E9%80%89&estate_id=11',
      );
      const firstPageBuildings = Array.from({ length: 500 }, (_, index) =>
        buildingItem({
          id: index + 1,
          estate_id: 1,
          estate_display_name: '全量项目',
          name: `${index + 1} 栋`,
          is_active: true,
        }),
      );
      const lastBuilding = buildingItem({
        id: 501,
        estate_id: 1,
        estate_display_name: '全量项目',
        name: '501 栋',
        is_active: true,
      });
      mockListEstates.mockResolvedValue({
        items: [
          {
            id: 1,
            name: 'all-estate',
            display_name: '全量项目',
            city: '深圳',
            district: '南山',
            address: '科技路',
            is_active: true,
            property_type: 'residential',
            province: '广东',
          },
        ],
        total: 1,
        page: 1,
        page_size: 20,
      });
      mockListBuildings.mockImplementation(
        (params?: Record<string, unknown>) => {
          if (params?.page_size === 500 && params?.page === 1) {
            return Promise.resolve({
              items: firstPageBuildings,
              total: 501,
              page: 1,
              page_size: 500,
            });
          }
          if (params?.page_size === 500 && params?.page === 2) {
            return Promise.resolve({
              items: [lastBuilding],
              total: 501,
              page: 2,
              page_size: 500,
            });
          }
          return Promise.resolve({
            items: [],
            total: 0,
            page: Number(params?.page || 1),
            page_size: Number(params?.page_size || 20),
          });
        },
      );

      renderPage(<EstatesPage />);

      expect(await screen.findByText('501栋')).toBeInTheDocument();
      await waitFor(() =>
        expect(mockListBuildings).toHaveBeenCalledWith({
          page: 2,
          page_size: 500,
        }),
      );
      expect(mockListBuildings).toHaveBeenCalledWith({
        page: 1,
        page_size: 500,
      });
      expect(mockListBuildings).not.toHaveBeenCalledWith(
        expect.objectContaining({ page_size: 500, keyword: '筛选' }),
      );
      expect(mockListBuildings).not.toHaveBeenCalledWith(
        expect.objectContaining({ page_size: 500, estate_id: 11 }),
      );

      fireEvent.click(screen.getByRole('button', { name: '清除小区筛选' }));
      fireEvent.change(screen.getByPlaceholderText('搜索项目 / 楼栋'), {
        target: { value: '二次筛选' },
      });
      fireEvent.keyDown(screen.getByPlaceholderText('搜索项目 / 楼栋'), {
        key: 'Enter',
        code: 'Enter',
      });

      await waitFor(() =>
        expect(mockListBuildings).toHaveBeenCalledWith(
          expect.objectContaining({ page_size: 20, keyword: '二次筛选' }),
        ),
      );
      expect(
        mockListBuildings.mock.calls.filter(
          ([params]) => params?.page_size === 500,
        ),
      ).toEqual([[{ page: 1, page_size: 500 }], [{ page: 2, page_size: 500 }]]);
    });

    it('filters estate governance queue for building address issues from URL', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/properties/estates?task=building_address',
      );
      mockListEstates.mockResolvedValue({
        items: [
          {
            id: 1,
            name: 'default-estate',
            display_name: '默认项目',
            city: '默认',
            district: '默认',
            address: '默认',
            is_active: true,
            property_type: 'residential',
            province: '默认',
          },
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });
      mockListBuildings.mockResolvedValue({
        items: [
          buildingItem({
            id: 2,
            estate_id: 1,
            estate_display_name: '默认项目',
            name: '默认楼栋',
            floors: 1,
            elevator: false,
            address: '',
            is_active: true,
          }),
          buildingItem({
            id: 3,
            estate_id: 1,
            estate_display_name: '默认项目',
            name: '完整楼栋',
            floors: 18,
            elevator: true,
            address: '科技路 1 号',
            is_active: true,
          }),
        ],
        total: 2,
        page: 1,
        page_size: 100,
      });

      renderPage(<EstatesPage />);

      expect((await screen.findAllByText('楼栋列表')).length).toBeGreaterThan(
        0,
      );
      expect(
        screen.queryByText('当前只看：待补楼栋地址'),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('radio', { name: '楼栋列表' }),
      ).toBeInTheDocument();
      expect(screen.queryByText('完整楼栋')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'plus 新建项目' }),
      ).not.toBeInTheDocument();
    });

    it('filters estate governance queue for estate address issues from URL', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/properties/estates?task=estate_address',
      );
      mockListEstates.mockResolvedValue({
        items: [
          {
            id: 1,
            name: 'pending-estate',
            display_name: '待补地址项目',
            city: '深圳',
            district: '南山',
            address: '',
            is_active: true,
            property_type: 'residential',
            province: '广东',
          },
          {
            id: 2,
            name: 'ready-estate',
            display_name: '完整项目',
            city: '深圳',
            district: '福田',
            address: '深南大道 1 号',
            is_active: true,
            property_type: 'residential',
            province: '广东',
          },
        ],
        total: 2,
        page: 1,
        page_size: 100,
      });
      mockListBuildings.mockResolvedValue({
        items: [
          buildingItem({
            id: 2,
            estate_id: 2,
            estate_display_name: '完整项目',
            name: '1 栋',
            floors: 18,
            elevator: true,
            address: '深南大道 1 号',
            is_active: true,
          }),
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<EstatesPage />);

      expect((await screen.findAllByText('项目列表')).length).toBeGreaterThan(
        0,
      );
      expect(
        screen.queryByText('当前只看：待补项目地址'),
      ).not.toBeInTheDocument();
      expect(await screen.findByText('待补地址项目')).toBeInTheDocument();
      expect(screen.queryByText('完整项目')).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: '补项目地址' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'plus 新建楼栋' }),
      ).not.toBeInTheDocument();
    });

    it('opens building creation drawer directly from the no-building queue context and clears edit state on close', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/properties/estates?task=no_building&building_create=1',
      );
      mockListEstates.mockResolvedValue({
        items: [
          {
            id: 1,
            name: 'default-estate',
            display_name: '默认项目',
            city: '默认',
            district: '默认',
            address: '默认',
            is_active: true,
            property_type: 'residential',
            province: '默认',
          },
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });
      mockListBuildings.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        page_size: 100,
      });

      renderPage(<EstatesPage />);

      expect(
        screen.queryByText('当前操作：为项目补首栋楼'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(
          '当前入口来自待补首栋楼队列，先为项目补齐第一栋可用楼栋，再继续登记房源。',
        ),
      ).not.toBeInTheDocument();
      expect(await screen.findByText('新建楼栋')).toBeInTheDocument();
      await waitFor(() => {
        const params = new URLSearchParams(window.location.search);
        expect(params.get('task')).toBe('no_building');
        expect(params.get('building_create')).toBe('1');
      });

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      await waitFor(() =>
        expect(window.location.search).toBe('?task=no_building'),
      );
    });
  });

  registerTestShard('rental-contacts', () => {
    it('creates contacts from the list page', async () => {
      renderPage(<ContactsPage />);

      fireEvent.click(
        await screen.findByRole('button', { name: 'plus 新建联系人' }),
      );
      fireEvent.change(screen.getByLabelText('姓名'), {
        target: { value: '王租客' },
      });
      fireEvent.change(screen.getByLabelText('手机'), {
        target: { value: '13700000000' },
      });
      fireEvent.mouseDown(screen.getByLabelText('角色'));
      const tenantOption = (await screen.findAllByText('租客')).at(-1);
      expect(tenantOption).toBeDefined();
      fireEvent.click(tenantOption as HTMLElement);
      fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

      await waitFor(() =>
        expect(mockCreateContact).toHaveBeenCalledWith(
          expect.objectContaining({
            name: '王租客',
            phone: '13700000000',
            roles: ['tenant'],
          }),
        ),
      );
    });

    it('requires a role when creating contacts', async () => {
      renderPage(<ContactsPage />);

      fireEvent.click(
        await screen.findByRole('button', { name: 'plus 新建联系人' }),
      );
      fireEvent.change(screen.getByLabelText('姓名'), {
        target: { value: '未选角色联系人' },
      });
      fireEvent.change(screen.getByLabelText('手机'), {
        target: { value: '13700000001' },
      });
      fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

      expect(await screen.findByText('请选择角色')).toBeInTheDocument();
      expect(mockCreateContact).not.toHaveBeenCalled();
    });

    it('clears legacy missing-role filters from the URL', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/customers?task=role_missing_active',
      );

      renderPage(<ContactsPage />);

      expect(
        await screen.findByRole('radiogroup', { name: '联系人角色筛选' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '全部' })).toBeChecked();
      expect(
        screen.queryByRole('radio', { name: '待补角色' }),
      ).not.toBeInTheDocument();
      await waitFor(() => expect(window.location.search).toBe(''));
      expect(mockListContacts).toHaveBeenCalledWith(
        expect.objectContaining({ task: 'active' }),
      );
    });

    it('does not allow bypassing status confirmation from the edit drawer', async () => {
      mockListContacts.mockResolvedValue({
        items: [
          {
            id: 3,
            name: '张房东',
            phone: '13800000000',
            roles: ['landlord'],
            is_active: false,
          },
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<ContactsPage />);

      const row = (await screen.findByText('张房东')).closest(
        'tr',
      ) as HTMLElement;
      fireEvent.click(within(row).getByRole('button', { name: '更多操作' }));
      fireEvent.click(await screen.findByText('编辑资料'));
      expect(
        screen.queryByRole('switch', { name: '启用' }),
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

      await waitFor(() =>
        expect(mockPatchContact).toHaveBeenCalledWith(
          3,
          expect.not.objectContaining({ is_active: expect.any(Boolean) }),
        ),
      );
    });

    it('从 URL 打开联系人编辑抽屉并在关闭时清除 edit 参数', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/customers?edit=3&role=landlord',
      );
      mockListContacts.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
      });

      renderPage(<ContactsPage />);

      await waitFor(() => expect(mockGetContact).toHaveBeenCalledWith(3));
      expect(await screen.findByText('编辑联系人')).toBeInTheDocument();
      expect(screen.getByLabelText('姓名')).toHaveValue('张房东');

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      await waitFor(() =>
        expect(window.location.search).toBe('?role=landlord'),
      );
    });

    it('忽略 popstate 清除 edit 后才返回的过期联系人详情', async () => {
      let resolveContact!: (contact: typeof defaultLandlord) => void;
      mockGetContact.mockReturnValue(
        new Promise((resolve) => {
          resolveContact = resolve;
        }),
      );
      window.history.pushState({}, '', '/rental/customers?edit=3');
      mockListContacts.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
      });

      renderPage(<ContactsPage />);
      await waitFor(() => expect(mockGetContact).toHaveBeenCalledWith(3));

      window.history.pushState({}, '', '/rental/customers');
      window.dispatchEvent(new PopStateEvent('popstate'));
      await act(async () => resolveContact(defaultLandlord));

      expect(screen.queryByText('编辑联系人')).not.toBeInTheDocument();
    });

    it('忽略切换组织后返回的同 ID 旧租户联系人', async () => {
      let resolveOrgA!: (contact: typeof defaultLandlord) => void;
      let resolveOrgB!: (contact: typeof defaultLandlord) => void;
      mockGetContact
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveOrgA = resolve;
          }),
        )
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveOrgB = resolve;
          }),
        );
      mockUseTenantWorkspace.mockReturnValue({
        selectedOrgSlug: 'org-a',
        queryClient: new QueryClient(),
      });
      window.history.pushState({}, '', '/rental/customers?edit=3');
      mockListContacts.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
      });
      const queryClient = new QueryClient();

      const view = render(
        <QueryClientProvider client={queryClient}>
          <ContactsPage />
        </QueryClientProvider>,
      );
      await waitFor(() => expect(mockGetContact).toHaveBeenCalledTimes(1));

      mockUseTenantWorkspace.mockReturnValue({
        selectedOrgSlug: 'org-b',
        queryClient: new QueryClient(),
      });
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <ContactsPage />
        </QueryClientProvider>,
      );
      await waitFor(() => expect(mockGetContact).toHaveBeenCalledTimes(2));
      await act(async () =>
        resolveOrgA({ ...defaultLandlord, name: 'A 组织房东' }),
      );

      expect(screen.queryByText('编辑联系人')).not.toBeInTheDocument();
      await act(async () =>
        resolveOrgB({ ...defaultLandlord, name: 'B 组织房东' }),
      );
    });

    it('toggles contact active state directly from the row action', async () => {
      mockListContacts.mockResolvedValue({
        items: [
          {
            id: 3,
            name: '张房东',
            phone: '13800000000',
            roles: ['landlord'],
            is_active: true,
          },
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<ContactsPage />);

      const row = (await screen.findByText('张房东')).closest(
        'tr',
      ) as HTMLElement;
      fireEvent.click(within(row).getByRole('button', { name: '更多操作' }));
      fireEvent.click(await screen.findByText('停用联系人'));
      const confirmDialog = (await screen.findByText('确认停用联系人')).closest(
        '[role="dialog"]',
      ) as HTMLElement;
      expect(confirmDialog).toBeInTheDocument();
      fireEvent.click(
        within(confirmDialog).getByRole('button', { name: '确认停用' }),
      );

      await waitFor(() =>
        expect(mockPatchContact).toHaveBeenCalledWith(3, { is_active: false }),
      );
    });

    it('does not offer new business actions for inactive contacts', async () => {
      mockListContacts.mockResolvedValue({
        items: [
          {
            id: 3,
            name: '停用房东',
            phone: '13800000000',
            email: 'off@example.com',
            roles: ['landlord', 'tenant'],
            is_active: false,
          },
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<ContactsPage />);

      expect(await screen.findByText(/停用房东/)).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: '登记房源' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: '登记带看' }),
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '更多操作' }));
      expect(await screen.findByText('启用联系人')).toBeInTheDocument();
    });

    it('scopes contact overview when filtering by role', async () => {
      mockListContacts.mockImplementation(
        (params?: Record<string, unknown>) => {
          if (params?.role === 'tenant') {
            return Promise.resolve({
              items: [
                {
                  id: 6,
                  name: '王租客',
                  phone: '13700000000',
                  email: 'tenant@example.com',
                  roles: ['tenant'],
                  is_active: true,
                },
              ],
              total: 1,
              page: 1,
              page_size: 100,
            });
          }
          return Promise.resolve({
            items: [
              {
                id: 3,
                name: '张房东',
                phone: '13800000000',
                email: 'landlord@example.com',
                roles: ['landlord'],
                is_active: true,
              },
              {
                id: 6,
                name: '王租客',
                phone: '13700000000',
                email: 'tenant@example.com',
                roles: ['tenant'],
                is_active: true,
              },
              {
                id: 8,
                name: '陈客户',
                phone: '13600000000',
                email: '',
                roles: ['landlord', 'tenant'],
                is_active: false,
              },
            ],
            total: 3,
            page: 1,
            page_size: 100,
          });
        },
      );

      renderPage(<ContactsPage />);

      fireEvent.click(screen.getByRole('radio', { name: '租客' }));

      expect(screen.queryByText(/当前只看/)).not.toBeInTheDocument();
      expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
      await waitFor(() =>
        expect(mockListContacts).toHaveBeenCalledWith(
          expect.objectContaining({ role: 'tenant' }),
        ),
      );
    });

    it('filters contacts from the toolbar search', async () => {
      renderPage(<ContactsPage />);

      await screen.findByRole('radiogroup', { name: '联系人角色筛选' });
      fireEvent.change(screen.getByPlaceholderText('搜索姓名 / 手机 / 邮箱'), {
        target: { value: '王租客' },
      });
      fireEvent.keyDown(screen.getByPlaceholderText('搜索姓名 / 手机 / 邮箱'), {
        key: 'Enter',
        code: 'Enter',
      });

      await waitFor(() =>
        expect(mockListContacts).toHaveBeenCalledWith(
          expect.objectContaining({ keyword: '王租客', page: 1 }),
        ),
      );
      await waitFor(() =>
        expect(window.location.search).toBe(
          '?keyword=%E7%8E%8B%E7%A7%9F%E5%AE%A2',
        ),
      );
    });

    it('filters contacts from the compact status view', async () => {
      mockListContacts.mockImplementation(
        (params?: Record<string, unknown>) => {
          return Promise.resolve({
            items: [
              {
                id: 3,
                name: '张房东',
                phone: '13800000000',
                email: 'landlord@example.com',
                roles: ['landlord'],
                is_active: true,
              },
              {
                id: 6,
                name: '王租客',
                phone: '13700000000',
                email: 'tenant@example.com',
                roles: ['tenant'],
                is_active: true,
              },
              {
                id: 8,
                name: '陈客户',
                phone: '13600000000',
                email: '',
                roles: ['landlord', 'tenant'],
                is_active: false,
                notes: '需要确认身份',
              },
            ],
            total: 3,
            page: 1,
            page_size: Number(params?.page_size || 20),
          });
        },
      );

      renderPage(<ContactsPage />);

      expect(await screen.findByText(/陈客户/)).toBeInTheDocument();
      await waitFor(() =>
        expect(mockListContacts).toHaveBeenCalledWith(
          expect.objectContaining({ task: 'active', page: 1 }),
        ),
      );
      fireEvent.mouseDown(
        screen.getByRole('combobox', { name: '联系人状态筛选' }),
      );
      fireEvent.click(await screen.findByText('已停用'));
      await waitFor(() =>
        expect(mockListContacts).toHaveBeenCalledWith(
          expect.objectContaining({ task: 'inactive', page: 1 }),
        ),
      );
    });

    it('restores contact filters from URL search params', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/customers?role=tenant&keyword=%E7%8E%8B%E7%A7%9F%E5%AE%A2&page=2',
      );
      mockListContacts.mockImplementation(
        (params?: Record<string, unknown>) => {
          if (
            params?.role === 'tenant' &&
            params?.keyword === '王租客' &&
            params?.page === 1 &&
            params?.page_size === 100
          ) {
            return Promise.resolve({
              items: [
                {
                  id: 6,
                  name: '王租客',
                  phone: '13700000000',
                  email: 'tenant@example.com',
                  roles: ['tenant'],
                  is_active: true,
                },
              ],
              total: 21,
              page: 1,
              page_size: 100,
            });
          }
          if (
            params?.role === 'tenant' &&
            params?.keyword === '王租客' &&
            params?.page === 2 &&
            params?.page_size === 20
          ) {
            return Promise.resolve({
              items: [
                {
                  id: 6,
                  name: '王租客',
                  phone: '13700000000',
                  email: 'tenant@example.com',
                  roles: ['tenant'],
                  is_active: true,
                },
              ],
              total: 21,
              page: 2,
              page_size: 20,
            });
          }
          return Promise.resolve({
            items: [],
            total: 0,
            page: Number(params?.page || 1),
            page_size: Number(params?.page_size || 20),
          });
        },
      );

      renderPage(<ContactsPage />);

      expect(screen.getByRole('radio', { name: '租客' })).toBeChecked();
      expect(screen.queryByText(/当前只看/)).not.toBeInTheDocument();
      expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
      await waitFor(() =>
        expect(mockListContacts).toHaveBeenCalledWith(
          expect.objectContaining({
            role: 'tenant',
            keyword: '王租客',
            page: 2,
          }),
        ),
      );
    });

    it('restores contact task filters from URL search params', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/customers?task=inactive&keyword=%E5%81%9C%E7%94%A8&page=2',
      );
      mockListContacts.mockImplementation(
        (params?: Record<string, unknown>) => {
          if (
            params?.keyword === '停用' &&
            params?.task === 'inactive' &&
            params?.page === 2 &&
            params?.page_size === 20
          ) {
            return Promise.resolve({
              items: [
                {
                  id: 8,
                  name: '停用联系人',
                  phone: '13600000000',
                  email: '',
                  roles: ['landlord'],
                  is_active: false,
                },
              ],
              total: 21,
              page: 2,
              page_size: 20,
            });
          }
          return Promise.resolve({
            items: [],
            total: 0,
            page: Number(params?.page || 1),
            page_size: Number(params?.page_size || 20),
          });
        },
      );

      renderPage(<ContactsPage />);

      expect(screen.getByText('已停用')).toBeInTheDocument();
      expect(screen.queryByText(/当前只看/)).not.toBeInTheDocument();
      expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
      await waitFor(() =>
        expect(mockListContacts).toHaveBeenCalledWith(
          expect.objectContaining({
            keyword: '停用',
            page: 2,
            task: 'inactive',
          }),
        ),
      );
      await waitFor(() =>
        expect(window.location.search).toBe(
          '?task=inactive&keyword=%E5%81%9C%E7%94%A8&page=2',
        ),
      );
    });
  });

  registerTestShard('rental-viewing-list', () => {
    it('filters viewings from the toolbar search', async () => {
      renderPage(<ViewingsPage />);

      await screen.findByText('带看列表');
      fireEvent.change(screen.getByPlaceholderText('客户 / 手机 / 房源'), {
        target: { value: '李客户' },
      });
      fireEvent.keyDown(screen.getByPlaceholderText('客户 / 手机 / 房源'), {
        key: 'Enter',
        code: 'Enter',
      });

      await waitFor(() =>
        expect(mockListViewings).toHaveBeenCalledWith(
          expect.objectContaining({ keyword: '李客户', page: 1 }),
        ),
      );
      await waitFor(() =>
        expect(window.location.search).toBe(
          '?keyword=%E6%9D%8E%E5%AE%A2%E6%88%B7',
        ),
      );
    });

    it('updates viewing status directly from the row action', async () => {
      mockListViewings.mockResolvedValue({
        items: [
          viewingItem(),
          viewingItem({
            id: 5,
            contact_id: 6,
            contact: defaultTenant,
            customer_name: '成交客户',
            customer_phone: '13800000000',
            scheduled_at: '2026-07-02T10:00:00+08:00',
            status: 'converted',
            signed_lease_id: 10,
          }),
        ],
        total: 2,
        page: 1,
        page_size: 100,
      });

      renderPage(<ViewingsPage />);

      const row = (await screen.findByText('李客户')).closest('tr');
      expect(row).not.toBeNull();
      expect(
        within(row as HTMLElement).queryByRole('button', { name: '完成带看' }),
      ).not.toBeInTheDocument();
      fireEvent.click(
        within(row as HTMLElement).getByRole('button', { name: '更多操作' }),
      );
      expect(screen.getByText('补租客')).toBeInTheDocument();
      expect(screen.getByText('标记成交')).toBeInTheDocument();
      expect(screen.getByText('取消')).toBeInTheDocument();
      expect(screen.getByText('标记爽约')).toBeInTheDocument();
      fireEvent.click(screen.getByText('完成带看'));

      await waitFor(() =>
        expect(mockPatchViewingRecord).toHaveBeenCalledWith(4, {
          status: 'viewed',
        }),
      );
      expect(
        within(
          (await screen.findByText('成交客户')).closest('tr') as HTMLElement,
        ).getByRole('button', { name: '更多操作' }),
      ).toBeInTheDocument();
    });
  });

  registerTestShard('rental-houses', () => {
    it('loads house table columns from the unified internal setting', async () => {
      renderPage(<HousesPage />);

      await waitFor(() =>
        expect(mockGetUserSetting).toHaveBeenCalledWith(
          { key: 'internal.ui.table_columns' },
          { skipErrorHandler: true },
        ),
      );
    });

    it('resets advanced house filters to the listed default', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/properties/list?status=vacant&inspection_due=true&inspection_reason=expired',
      );

      renderPage(<HousesPage />);

      fireEvent.click(screen.getByRole('button', { name: /高级筛选/ }));
      fireEvent.click(screen.getByRole('button', { name: '重置' }));

      const statusSelect = await screen.findByRole('combobox', {
        name: '房态筛选',
      });
      expect(
        within(statusSelect.closest('.ant-select') as HTMLElement).getByText(
          '招租',
        ),
      ).toBeInTheDocument();
      const inspectionSelect = screen.getByRole('combobox', {
        name: '勘察筛选',
      });
      expect(
        within(
          inspectionSelect.closest('.ant-select') as HTMLElement,
        ).getByText('全部勘察状态'),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '确定筛选' }));

      await waitFor(() => {
        const params = new URLSearchParams(window.location.search);
        expect(params.get('status')).toBe('listed');
        expect(params.get('inspection_due')).toBeNull();
        expect(params.get('inspection_reason')).toBeNull();
      });
      await waitFor(() => {
        const resetParams = mockListHouses.mock.calls
          .map(([params]) => params as Record<string, unknown>)
          .find((params) => params.status === 'listed');
        expect(resetParams).toBeDefined();
        expect(resetParams).not.toHaveProperty('inspection_due');
        expect(resetParams).not.toHaveProperty('inspection_reason');
      });
    });

    it('filters houses by building_id from the URL and preserves unrelated query params when clearing the scope from the asset navigator', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/properties/list?building_id=11&foo=x',
      );

      renderPage(<HousesPage />);

      await waitFor(() => expect(mockGetBuilding).toHaveBeenCalledWith(11));
      await waitFor(() =>
        expect(mockListHouses).toHaveBeenCalledWith({
          building_id: 11,
          page: 1,
          page_size: 20,
          keyword: undefined,
          scope: 'all',
          status: undefined,
        }),
      );
      expect(screen.queryByLabelText('房源列表上下文')).not.toBeInTheDocument();
      expect(await screen.findByText('房源范围')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '全部房源' }));

      await waitFor(() =>
        expect(window.location.search).not.toContain('building_id'),
      );
      expect(new URLSearchParams(window.location.search).get('foo')).toBe('x');
      await waitFor(() =>
        expect(mockListHouses).toHaveBeenCalledWith({
          page: 1,
          page_size: 20,
          keyword: undefined,
          scope: 'all',
          status: undefined,
        }),
      );
    });

    it('filters houses by an estate selected from the integrated asset navigator', async () => {
      renderPage(<HousesPage />);

      fireEvent.click(
        await screen.findByRole(
          'button',
          {
            name: '选择项目 星河湾',
          },
          { timeout: 5_000 },
        ),
      );

      await waitFor(() =>
        expect(mockListHouses).toHaveBeenCalledWith(
          expect.objectContaining({
            estate_id: defaultEstate.id,
            page: 1,
            page_size: 20,
          }),
        ),
      );
      expect(new URLSearchParams(window.location.search).get('estate_id')).toBe(
        String(defaultEstate.id),
      );
    });

    it('opens contextual project and building management from the asset navigator', async () => {
      renderPage(<HousesPage />);

      await waitFor(() =>
        expect(mockListEstates).toHaveBeenCalledWith({
          page: 1,
          page_size: 30,
          scope: 'all',
        }),
      );

      const estateButton = await screen.findByRole('button', {
        name: '选择项目 星河湾',
      });
      const createBuildingButton = estateButton.parentElement?.querySelector(
        'button[aria-label="新建星河湾楼栋"]',
      );
      expect(createBuildingButton).not.toBeNull();
      fireEvent.click(createBuildingButton as HTMLButtonElement);

      await waitFor(() =>
        expect(
          new URLSearchParams(window.location.search).get('building_create'),
        ).toBe('1'),
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('opens top-level project and standalone-building creation from the asset navigator', async () => {
      renderPage(<HousesPage />);

      await waitFor(() =>
        expect(mockListEstates).toHaveBeenCalledWith({
          page: 1,
          page_size: 30,
          scope: 'all',
        }),
      );
      fireEvent.click(screen.getByRole('button', { name: '新建项目' }));
      expect(
        new URLSearchParams(window.location.search).get('estate_create'),
      ).toBe('1');

      fireEvent.click(screen.getByRole('button', { name: '新建独立楼栋' }));
      const params = new URLSearchParams(window.location.search);
      expect(params.get('estate_create')).toBeNull();
      expect(params.get('building_create')).toBe('standalone');
    });

    it('allows multiple house rows to stay in edit mode', async () => {
      const nextBuilding = buildingItem({ id: 7, name: '2 栋' });
      const nextLandlord = {
        id: 8,
        name: '李房东',
        phone: '13900000000',
      };
      mockListHouses.mockResolvedValue({
        items: [
          houseItem({ id: 99, room_number: 'A-101' }),
          houseItem({ id: 100, room_number: 'A-102' }),
        ],
        total: 2,
        page: 1,
        page_size: 20,
      });
      mockPatchHouse.mockResolvedValue(
        houseItem({
          id: 99,
          room_number: 'A-101',
          building_id: nextBuilding.id,
          building: nextBuilding,
          landlord_id: nextLandlord.id,
          landlord: nextLandlord,
        }),
      );

      renderPage(<HousesPage />);

      const firstRow = (await screen.findByText('A-101')).closest(
        'tr',
      ) as HTMLElement;
      fireEvent.click(
        within(firstRow).getByRole('button', { name: '快速编辑房源 A-101' }),
      );
      expect(await screen.findAllByLabelText('卧室')).toHaveLength(1);
      expect(screen.getByLabelText('所属楼栋')).toBeInTheDocument();
      expect(screen.getByLabelText('房东')).toBeInTheDocument();
      expect(screen.getByLabelText('房源标签')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('搜索房号 / 小区 / 楼栋 / 房东'),
      ).toBeDisabled();
      expect(screen.getByRole('button', { name: '高级筛选' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '全部房源' })).toBeDisabled();
      expect(screen.queryByLabelText('房源列表上下文')).not.toBeInTheDocument();

      const secondRow = screen.getByText('A-102').closest('tr') as HTMLElement;
      fireEvent.click(
        within(secondRow).getByRole('button', { name: '快速编辑房源 A-102' }),
      );

      expect(await screen.findAllByLabelText('卧室')).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: '保存' })).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: '取消' })).toHaveLength(2);

      fireEvent.click(screen.getAllByRole('button', { name: '保存' })[0]);

      await waitFor(() =>
        expect(mockPatchHouse).toHaveBeenCalledWith(
          99,
          expect.objectContaining({ room_number: 'A-101' }),
        ),
      );
      expect(await screen.findByText('2 栋')).toBeInTheDocument();
      expect(screen.getByText('李房东')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: '保存' })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: '取消' })).toHaveLength(1);
    });

    it('keeps selected remote values first when their full objects are missing', async () => {
      mockListBuildings.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
      });
      mockListContacts.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
      });
      mockListHouses.mockResolvedValue({
        items: [
          houseItem({
            building_id: 42,
            building: undefined,
            landlord_id: 77,
            landlord: undefined,
          }),
        ],
        total: 1,
        page: 1,
        page_size: 20,
      });

      renderPage(<HousesPage />);

      const row = (await screen.findByText('A-101')).closest(
        'tr',
      ) as HTMLElement;
      fireEvent.click(
        within(row).getByRole('button', { name: '快速编辑房源 A-101' }),
      );

      expect(await screen.findByText('楼栋 #42')).toBeInTheDocument();
      expect(screen.getByText('联系人 #77')).toBeInTheDocument();
    });

    it('requires confirmation before publishing a house from the list', async () => {
      mockPatchHouse.mockResolvedValue(
        houseItem({
          asking_rent: '4200.00',
          status: 'listed',
          images: [
            {
              media_id: 1,
              media_type: 'image',
              image_role: 'cover',
              url: '/cover.jpg',
            },
            {
              media_id: 2,
              media_type: 'image',
              image_role: 'floor_plan',
              url: '/plan.jpg',
            },
            {
              media_id: 3,
              media_type: 'image',
              image_role: 'bedroom',
              url: '/bedroom.jpg',
            },
          ],
          videos: [{ media_id: 4, media_type: 'video' }],
        }),
      );
      mockListHouses.mockResolvedValue({
        items: [
          houseItem({
            asking_rent: '4200.00',
            status: 'vacant',
            images: [
              {
                media_id: 1,
                media_type: 'image',
                image_role: 'cover',
                url: '/cover.jpg',
              },
              {
                media_id: 2,
                media_type: 'image',
                image_role: 'floor_plan',
                url: '/plan.jpg',
              },
              {
                media_id: 3,
                media_type: 'image',
                image_role: 'bedroom',
                url: '/bedroom.jpg',
              },
            ],
            videos: [{ media_id: 4, media_type: 'video' }],
          }),
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<HousesPage />);

      const publishRow = (await screen.findByText(/张房东/)).closest('tr');
      expect(publishRow).not.toBeNull();
      fireEvent.click(
        within(publishRow as HTMLElement).getByRole('button', {
          name: '更多操作',
        }),
      );
      fireEvent.click(await screen.findByRole('menuitem', { name: '发布' }));

      expect(
        await screen.findByText('确认后房源状态将切换为招租，继续承接带看。'),
      ).toBeInTheDocument();
      expect(mockPatchHouse).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: '确认发布' }));

      await waitFor(() =>
        expect(mockPatchHouse).toHaveBeenCalledWith(
          99,
          expect.objectContaining({ status: 'listed' }),
        ),
      );
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
    });

    it('uses organization publish rules before opening list publish confirmation', async () => {
      mockUseHousePublishRules.mockReturnValue({
        isPending: false,
        rules: {
          landlord: { mode: 'required' },
          rent: { mode: 'required' },
          cover: { mode: 'required' },
          images: { mode: 'required', min_count: 3 },
          floor_plan: { mode: 'required' },
          video: { mode: 'required', min_count: 1 },
        },
      });
      mockListHouses.mockResolvedValue({
        items: [
          houseItem({
            asking_rent: '4200.00',
            status: 'vacant',
            images: [
              { media_id: 1, media_type: 'image', image_role: 'cover' },
              { media_id: 2, media_type: 'image', image_role: 'floor_plan' },
              { media_id: 3, media_type: 'image', image_role: 'bedroom' },
            ],
            videos: [],
          }),
        ],
        total: 1,
        page: 1,
        page_size: 20,
      });

      renderPage(<HousesPage />);

      const publishRow = (await screen.findByText(/张房东/)).closest('tr');
      fireEvent.click(
        within(publishRow as HTMLElement).getByRole('button', {
          name: '更多操作',
        }),
      );
      fireEvent.click(await screen.findByRole('menuitem', { name: '发布' }));

      expect(
        screen.queryByText('确认后房源状态将切换为招租，继续承接带看。'),
      ).not.toBeInTheDocument();
      expect(await screen.findByText('请先补齐：视频不足')).toBeInTheDocument();
      expect(mockPatchHouse).not.toHaveBeenCalled();
    });

    it('opens deal signing from the house row more menu', async () => {
      renderPage(<HousesPage />);

      const row = (await screen.findByText('A-101')).closest('tr');
      expect(row).not.toBeNull();
      fireEvent.click(
        within(row as HTMLElement).getByRole('button', { name: '更多操作' }),
      );
      fireEvent.click(
        await screen.findByRole('menuitem', { name: '成交签约' }),
      );

      expect(await screen.findByText('租客资料')).toBeInTheDocument();
      expect(screen.getByText('租期与金额')).toBeInTheDocument();
      expect(screen.getAllByText('收益归属').length).toBeGreaterThan(0);
      expect(mockHistoryPush).not.toHaveBeenCalledWith(
        '/rental/leases?house_id=99&action=deal-signing',
      );
    });
  });

  registerTestShard('rental-house-filters', () => {
    it('filters inspection houses by reason and confirms unchanged information', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/properties/list?scope=mine&inspection_due=true&inspection_reason=expired',
      );
      const expiredHouse = houseItem({
        inspection_reasons: ['expired'],
        inspection_max_age_days: 180,
        updated_at: '2026-01-01T10:00:00+08:00',
      });
      mockListHouses.mockResolvedValue({
        items: [expiredHouse],
        total: 1,
        page: 1,
        page_size: 20,
      });
      mockPatchHouse.mockResolvedValue({
        ...expiredHouse,
        inspection_reasons: [],
        updated_at: '2026-08-29T10:00:00+08:00',
      });

      renderPage(<HousesPage />);

      await waitFor(() =>
        expect(mockListHouses).toHaveBeenCalledWith(
          expect.objectContaining({ inspection_reason: 'expired' }),
        ),
      );

      const moreActions = await screen.findAllByLabelText('更多操作');
      fireEvent.click(moreActions[moreActions.length - 1]);
      fireEvent.click(await screen.findByText('确认资料仍有效'));
      fireEvent.click(screen.getByRole('button', { name: '确认仍有效' }));

      await waitFor(() =>
        expect(mockPatchHouse).toHaveBeenCalledWith(expiredHouse.id, {
          confirm_current: true,
        }),
      );
    });

    it('changes page size and resets the current page', async () => {
      window.history.pushState({}, '', '/rental/properties/list?page=3&foo=x');
      mockListHouses.mockResolvedValue({
        items: [houseItem()],
        total: 120,
        page: 3,
        page_size: 20,
      });

      renderPage(<HousesPage />);

      fireEvent.change(screen.getByRole('combobox', { name: '每页条数' }), {
        target: { value: '50' },
      });

      await waitFor(() =>
        expect(mockListHouses).toHaveBeenCalledWith(
          expect.objectContaining({ page: 1, page_size: 50 }),
        ),
      );
      await waitFor(() => {
        const params = new URLSearchParams(window.location.search);
        expect(params.get('page')).toBeNull();
        expect(params.get('page_size')).toBe('50');
        expect(params.get('foo')).toBe('x');
      });
    });

    it('restores house keyword from URL search params', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/properties/list?keyword=A-101&status=vacant&page=2',
      );

      renderPage(<HousesPage />);

      expect(
        await screen.findByRole('link', { name: '完整编辑' }),
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue('A-101')).toBeInTheDocument();
      await waitFor(() =>
        expect(mockListHouses).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 2,
            keyword: 'A-101',
            status: 'vacant',
          }),
        ),
      );
    });

    it('sorts the house list through server ordering and resets pagination', async () => {
      window.history.pushState({}, '', '/rental/properties/list?page=2&foo=x');

      renderPage(<HousesPage />);

      await waitFor(() =>
        expect(mockListHouses).toHaveBeenCalledWith(
          expect.objectContaining({ page: 2 }),
        ),
      );

      let rentHeader = await screen.findByRole('columnheader', {
        name: '挂牌租金',
      });
      fireEvent.click(
        within(rentHeader).getByRole('button', { name: '挂牌租金' }),
      );

      await waitFor(() =>
        expect(mockListHouses).toHaveBeenCalledWith(
          expect.objectContaining({ ordering: 'asking_rent', page: 1 }),
        ),
      );
      expect(new URLSearchParams(window.location.search).get('ordering')).toBe(
        'asking_rent',
      );
      expect(
        new URLSearchParams(window.location.search).get('page'),
      ).toBeNull();
      expect(new URLSearchParams(window.location.search).get('foo')).toBe('x');

      rentHeader = await screen.findByRole('columnheader', {
        name: '挂牌租金',
      });
      fireEvent.click(
        within(rentHeader).getByRole('button', { name: '挂牌租金' }),
      );

      await waitFor(() =>
        expect(mockListHouses).toHaveBeenCalledWith(
          expect.objectContaining({ ordering: '-asking_rent', page: 1 }),
        ),
      );
      expect(new URLSearchParams(window.location.search).get('ordering')).toBe(
        '-asking_rent',
      );

      rentHeader = await screen.findByRole('columnheader', {
        name: '挂牌租金',
      });
      fireEvent.click(
        within(rentHeader).getByRole('button', { name: '挂牌租金' }),
      );

      await waitFor(() => {
        const lastParams = mockListHouses.mock.calls.at(-1)?.[0];
        expect(lastParams).not.toHaveProperty('ordering');
        expect(lastParams).toEqual(expect.objectContaining({ page: 1 }));
      });
      expect(
        new URLSearchParams(window.location.search).get('ordering'),
      ).toBeNull();
    });

    it('syncs house search state back to URL', async () => {
      renderPage(<HousesPage />);

      const searchInput = screen.getByPlaceholderText(
        '搜索房号 / 小区 / 楼栋 / 房东',
      );
      fireEvent.change(searchInput, { target: { value: 'A-101' } });
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      await waitFor(() =>
        expect(window.location.search).toBe('?keyword=A-101'),
      );
    });

    it('restores house search state on browser popstate', async () => {
      renderPage(<HousesPage />);

      window.history.pushState(
        {},
        '',
        '/rental/properties/list?keyword=QA-104&scope=mine&inspection_due=true',
      );
      window.dispatchEvent(new PopStateEvent('popstate'));

      expect(
        await screen.findByRole('link', { name: '查看详情' }),
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue('QA-104')).toBeInTheDocument();
      await waitFor(() =>
        expect(mockListHouses).toHaveBeenCalledWith(
          expect.objectContaining({
            keyword: 'QA-104',
            scope: 'mine',
            inspection_due: true,
          }),
        ),
      );
    });

    it('offers house creation when the current scope is empty', async () => {
      mockListHouses.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
      });

      renderPage(<HousesPage />);

      expect(await screen.findByText('当前范围暂无房源')).toBeInTheDocument();
      const createButtons = screen.getAllByRole('button', { name: '新建房源' });
      fireEvent.click(createButtons.at(-1) as HTMLElement);
      expect(mockHistoryPush).toHaveBeenCalledWith('/rental/properties/new');
    });
  });

  registerTestShard('rental-viewing-workflows', () => {
    it('filters converted viewings from URL and links to lease creation', async () => {
      window.history.pushState({}, '', '/rental/viewings?status=converted');
      mockListViewings.mockResolvedValue({
        items: [
          viewingItem({
            contact_id: 6,
            contact: defaultTenant,
            status: 'converted',
            signed_lease_id: null,
          }),
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<ViewingsPage />);

      expect(screen.queryByText(/当前只看/)).not.toBeInTheDocument();
      await waitFor(() =>
        expect(mockListViewings).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'converted' }),
        ),
      );
      const row = (await screen.findByText(/李客户/)).closest(
        'tr',
      ) as HTMLElement;
      expect(
        within(row).getByRole('button', { name: '编辑' }),
      ).toBeInTheDocument();
      expect(within(row).getByRole('link', { name: '签约' })).toHaveAttribute(
        'href',
        '/dashboard/rental/leases?source_viewing_record_id=4',
      );
      expect((row.textContent || '').indexOf('编辑')).toBeLessThan(
        (row.textContent || '').indexOf('签约'),
      );
    });

    it('requires contact completion before offering lease creation for converted viewings', async () => {
      mockListViewings.mockResolvedValue({
        items: [viewingItem({ status: 'converted', signed_lease_id: null })],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<ViewingsPage />);

      const row = (await screen.findByText('李客户')).closest(
        'tr',
      ) as HTMLElement;
      expect(row).toHaveTextContent(/未绑定租客/);
      expect(
        within(row).queryByRole('button', { name: '补租客' }),
      ).not.toBeInTheDocument();
      expect(
        within(row).getByRole('button', { name: '更多操作' }),
      ).toBeInTheDocument();
      expect(within(row).getByRole('button', { name: '签约' })).toBeDisabled();
      expect(within(row).getByRole('button', { name: '签约' })).toHaveAttribute(
        'title',
        '请先补齐租客联系人',
      );
    });

    it('opens edit drawer with a warning when fixing converted viewings without linked contacts', async () => {
      mockListViewings.mockResolvedValue({
        items: [viewingItem({ status: 'converted', signed_lease_id: null })],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<ViewingsPage />);

      const row = (await screen.findByText('李客户')).closest(
        'tr',
      ) as HTMLElement;
      fireEvent.click(within(row).getByRole('button', { name: '更多操作' }));
      fireEvent.click(screen.getByText('补租客'));

      expect(
        await screen.findByText(/该成交记录尚未绑定租客联系人/),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('关联联系人')).toBeInTheDocument();
    });

    it('shows the existing lease after a converted viewing has signed', async () => {
      mockListViewings.mockResolvedValue({
        items: [
          viewingItem({
            contact_id: 6,
            contact: defaultTenant,
            status: 'converted',
            signed_lease_id: 10,
          }),
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<ViewingsPage />);

      const row = (await screen.findByText(/李客户/)).closest(
        'tr',
      ) as HTMLElement;
      expect(
        within(row).getByText('查看租约').closest('[data-preview="lease"]'),
      ).toHaveAttribute('data-id', '10');
      expect(
        within(row).getByRole('button', { name: '编辑' }),
      ).toBeInTheDocument();
      expect(
        within(row).queryByRole('button', { name: '签约' }),
      ).not.toBeInTheDocument();
      expect((row.textContent || '').indexOf('编辑')).toBeLessThan(
        (row.textContent || '').indexOf('查看租约'),
      );
    });

    it('keeps sign action visible but disabled before a viewing is converted', async () => {
      mockListViewings.mockResolvedValue({
        items: [viewingItem({ status: 'scheduled', signed_lease_id: null })],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<ViewingsPage />);

      const row = (await screen.findByText(/李客户/)).closest(
        'tr',
      ) as HTMLElement;
      expect(within(row).getByRole('button', { name: '签约' })).toBeDisabled();
      expect(within(row).getByRole('button', { name: '签约' })).toHaveAttribute(
        'title',
        '带看成交后才可签约',
      );
    });

    it('filters pending lease viewings from URL', async () => {
      window.history.pushState({}, '', '/rental/viewings?pending_lease=true');
      const readyViewing = viewingItem({
        contact_id: 6,
        contact: defaultTenant,
        status: 'converted',
        signed_lease_id: null,
      });
      mockListViewings.mockImplementation(
        (params?: Record<string, unknown>) => {
          if (params?.pending_lease && params?.contact_missing === true) {
            return Promise.resolve({
              items: [],
              total: 0,
              page: 1,
              page_size: Number(params?.page_size || 20),
            });
          }
          if (params?.pending_lease) {
            return Promise.resolve({
              items: [readyViewing],
              total: 1,
              page: 1,
              page_size: Number(params?.page_size || 20),
            });
          }
          return Promise.resolve({
            items: [],
            total: 0,
            page: 1,
            page_size: Number(params?.page_size || 20),
          });
        },
      );

      renderPage(<ViewingsPage />);

      expect(screen.queryByText(/当前只看/)).not.toBeInTheDocument();
      expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
      await waitFor(() =>
        expect(mockListViewings).toHaveBeenCalledWith(
          expect.objectContaining({ pending_lease: true }),
        ),
      );
    });

    it('restores viewing status and page filters from URL search params', async () => {
      window.history.pushState({}, '', '/rental/viewings?status=viewed&page=2');
      mockListViewings.mockImplementation(
        (params?: Record<string, unknown>) => {
          if (params?.status === 'scheduled') {
            return Promise.resolve({
              items: [],
              total: 0,
              page: 1,
              page_size: 1,
            });
          }
          if (
            params?.status === 'viewed' &&
            params?.page === 1 &&
            params?.page_size === 1
          ) {
            return Promise.resolve({
              items: [],
              total: 3,
              page: 1,
              page_size: 1,
            });
          }
          if (params?.pending_lease) {
            return Promise.resolve({
              items: [],
              total: 0,
              page: 1,
              page_size: 1,
            });
          }
          if (params?.status === 'canceled') {
            return Promise.resolve({
              items: [],
              total: 0,
              page: 1,
              page_size: 1,
            });
          }
          if (params?.status === 'no_show') {
            return Promise.resolve({
              items: [],
              total: 0,
              page: 1,
              page_size: 1,
            });
          }
          if (
            params?.status === 'viewed' &&
            params?.page === 2 &&
            params?.page_size === 20
          ) {
            return Promise.resolve({
              items: [
                viewingItem({
                  id: 5,
                  customer_name: '回访客户',
                  customer_phone: '13800000000',
                  scheduled_at: '2026-07-01T12:00:00+08:00',
                  status: 'viewed',
                }),
              ],
              total: 21,
              page: 2,
              page_size: 20,
            });
          }
          return Promise.resolve({
            items: [],
            total: 0,
            page: Number(params?.page || 1),
            page_size: Number(params?.page_size || 20),
          });
        },
      );

      renderPage(<ViewingsPage />);

      expect(screen.queryByText(/当前只看/)).not.toBeInTheDocument();
      expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
      await waitFor(() =>
        expect(mockListViewings).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'viewed', page: 2 }),
        ),
      );
    });

    it('syncs viewing status filter back to URL', async () => {
      renderPage(<ViewingsPage />);

      fireEvent.mouseDown(await screen.findByRole('combobox'));
      fireEvent.click(
        (await screen.findAllByText('已带看')).at(-1) as HTMLElement,
      );

      await waitFor(() =>
        expect(window.location.search).toBe('?status=viewed'),
      );
      expect(window.location.search).toBe('?status=viewed');
    });

    it('filters converted viewings missing contacts from URL', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/viewings?pending_lease=true&contact_missing=true',
      );
      const missingContactViewing = viewingItem({
        status: 'converted',
        signed_lease_id: null,
      });
      mockListViewings.mockImplementation(
        (params?: Record<string, unknown>) => {
          if (params?.pending_lease && params?.contact_missing === false) {
            return Promise.resolve({
              items: [],
              total: 0,
              page: 1,
              page_size: Number(params?.page_size || 20),
            });
          }
          if (params?.pending_lease || params?.status === 'converted') {
            return Promise.resolve({
              items: [missingContactViewing],
              total: 1,
              page: 1,
              page_size: Number(params?.page_size || 20),
            });
          }
          return Promise.resolve({
            items: [],
            total: 0,
            page: 1,
            page_size: Number(params?.page_size || 20),
          });
        },
      );

      renderPage(<ViewingsPage />);

      expect(screen.queryByText(/当前只看/)).not.toBeInTheDocument();
      expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
      expect(screen.queryByText('可签约')).not.toBeInTheDocument();
      const missingContactRow = (await screen.findByText('李客户')).closest(
        'tr',
      ) as HTMLElement;
      fireEvent.click(
        within(missingContactRow).getByRole('button', { name: '更多操作' }),
      );
      expect(screen.getByText('补租客')).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: '签约' }),
      ).not.toBeInTheDocument();
      await waitFor(() =>
        expect(mockListViewings).toHaveBeenCalledWith(
          expect.objectContaining({
            pending_lease: true,
            contact_missing: true,
          }),
        ),
      );
    });

    it('filters ready-to-lease converted viewings from URL', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/viewings?pending_lease=true&contact_missing=false',
      );
      const readyViewing = viewingItem({
        contact_id: 6,
        contact: defaultTenant,
        status: 'converted',
        signed_lease_id: null,
      });
      mockListViewings.mockImplementation(
        (params?: Record<string, unknown>) => {
          if (params?.pending_lease && params?.contact_missing === true) {
            return Promise.resolve({
              items: [],
              total: 0,
              page: 1,
              page_size: Number(params?.page_size || 20),
            });
          }
          if (params?.pending_lease || params?.status === 'converted') {
            return Promise.resolve({
              items: [readyViewing],
              total: 1,
              page: 1,
              page_size: Number(params?.page_size || 20),
            });
          }
          return Promise.resolve({
            items: [],
            total: 0,
            page: 1,
            page_size: Number(params?.page_size || 20),
          });
        },
      );

      renderPage(<ViewingsPage />);

      expect(screen.queryByText(/当前只看/)).not.toBeInTheDocument();
      expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
      expect(await screen.findByRole('link', { name: '签约' })).toHaveAttribute(
        'href',
        '/dashboard/rental/leases?source_viewing_record_id=4',
      );
      expect(
        screen.queryByRole('button', { name: '补租客' }),
      ).not.toBeInTheDocument();
      await waitFor(() =>
        expect(mockListViewings).toHaveBeenCalledWith(
          expect.objectContaining({
            pending_lease: true,
            contact_missing: false,
          }),
        ),
      );
    });

    it('keeps ready-to-lease overview aligned with the filtered queue', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/viewings?pending_lease=true&contact_missing=false',
      );
      mockListViewings.mockImplementation(
        (params?: Record<string, unknown>) => {
          if (params?.pending_lease && params?.contact_missing === false) {
            return Promise.resolve({
              items: [],
              total: 0,
              page: 1,
              page_size: 20,
            });
          }
          if (params?.pending_lease) {
            return Promise.resolve({
              items: [
                viewingItem({ status: 'converted', signed_lease_id: null }),
              ],
              total: 1,
              page: 1,
              page_size: 1,
            });
          }
          return Promise.resolve({
            items: [],
            total: 0,
            page: 1,
            page_size: 20,
          });
        },
      );

      renderPage(<ViewingsPage />);

      expect(screen.queryByText(/当前只看/)).not.toBeInTheDocument();
      expect(await screen.findByText('当前可签约队列为空')).toBeInTheDocument();
      expect(
        await screen.findByText(
          '当前没有主体完整且可直接签约的成交记录，先回到待补租客补齐主体，再继续签约。',
        ),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText('查看待补租客').closest('a')).toHaveAttribute(
          'href',
          '/dashboard/rental/viewings?pending_lease=true&contact_missing=true',
        );
        expect(screen.getByText('查看待签约').closest('a')).toHaveAttribute(
          'href',
          '/dashboard/rental/viewings?pending_lease=true',
        );
      });
    });

    it('keeps missing-contact overview aligned with the filtered queue', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/viewings?pending_lease=true&contact_missing=true',
      );
      mockListViewings.mockImplementation(
        (params?: Record<string, unknown>) => {
          if (params?.pending_lease && params?.contact_missing === true) {
            return Promise.resolve({
              items: [],
              total: 0,
              page: 1,
              page_size: 20,
            });
          }
          if (params?.pending_lease) {
            return Promise.resolve({
              items: [
                viewingItem({ status: 'converted', signed_lease_id: null }),
              ],
              total: 1,
              page: 1,
              page_size: 1,
            });
          }
          if (params?.status === 'converted') {
            return Promise.resolve({
              items: [
                viewingItem({ status: 'converted', signed_lease_id: null }),
              ],
              total: 1,
              page: 1,
              page_size: 1,
            });
          }
          return Promise.resolve({
            items: [],
            total: 0,
            page: 1,
            page_size: 20,
          });
        },
      );

      renderPage(<ViewingsPage />);

      expect(screen.queryByText(/当前只看/)).not.toBeInTheDocument();
      expect(
        await screen.findByText('待补租客队列已处理完成'),
      ).toBeInTheDocument();
      expect(
        await screen.findByText(
          '当前筛选下已没有缺租客主体的成交记录，继续处理可签约或全部待签约队列。',
        ),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText('查看可签约').closest('a')).toHaveAttribute(
          'href',
          '/dashboard/rental/viewings?pending_lease=true&contact_missing=false',
        );
        expect(screen.getByText('查看待签约').closest('a')).toHaveAttribute(
          'href',
          '/dashboard/rental/viewings?pending_lease=true',
        );
      });
    });

    it('creates viewing records without sending status', async () => {
      renderPage(<ViewingsPage />);

      fireEvent.click(
        await screen.findByRole('button', { name: 'plus 新建带看' }),
      );
      expect(screen.getByLabelText('房源')).toBeInTheDocument();
      expect(screen.queryByLabelText('状态')).not.toBeInTheDocument();

      fireEvent.mouseDown(screen.getByLabelText('房源'));
      const houseOption = (
        await screen.findAllByText('星河湾花园 / 1 栋 / A-101')
      ).at(-1);
      expect(houseOption).toBeDefined();
      fireEvent.click(houseOption as HTMLElement);
      fireEvent.change(screen.getByLabelText('客户姓名'), {
        target: { value: '赵客户' },
      });
      fireEvent.change(screen.getByLabelText('客户手机'), {
        target: { value: '13600000000' },
      });
      fireEvent.change(screen.getByLabelText('预约时间'), {
        target: { value: '2026-07-02T10:00' },
      });
      fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

      await waitFor(() => expect(mockCreateViewingRecord).toHaveBeenCalled());
      expect(mockCreateViewingRecord.mock.calls[0][0]).toEqual({
        house_id: 99,
        customer_name: '赵客户',
        customer_phone: '13600000000',
        scheduled_at: '2026-07-02T10:00',
      });
    });

    it('fills viewing customer fields from the selected contact', async () => {
      mockListContacts.mockResolvedValue({
        items: [
          { id: 6, name: '王租客', phone: '13700000000', roles: ['tenant'] },
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<ViewingsPage />);

      fireEvent.click(
        await screen.findByRole('button', { name: 'plus 新建带看' }),
      );
      fireEvent.mouseDown(screen.getByLabelText('关联联系人'));
      const contactOption = (
        await screen.findAllByText('王租客 / 13700000000')
      ).at(-1);
      expect(contactOption).toBeDefined();
      fireEvent.click(contactOption as HTMLElement);

      expect(screen.getByLabelText('客户姓名')).toHaveValue('王租客');
      expect(screen.getByLabelText('客户手机')).toHaveValue('13700000000');
    });

    it('clears viewing draft values when reopening the create drawer', async () => {
      renderPage(<ViewingsPage />);

      fireEvent.click(
        await screen.findByRole('button', { name: 'plus 新建带看' }),
      );
      fireEvent.change(screen.getByLabelText('客户姓名'), {
        target: { value: '赵客户' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      fireEvent.click(
        await screen.findByRole('button', { name: 'plus 新建带看' }),
      );

      expect(screen.getByLabelText('客户姓名')).toHaveValue('');
    });

    it('refills viewing edit values when reopening the edit drawer', async () => {
      renderPage(<ViewingsPage />);

      expect(await screen.findByText('李客户')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '编辑' }));
      expect(await screen.findByText('编辑带看')).toBeInTheDocument();
      expect(screen.getByLabelText('客户姓名')).toHaveValue('李客户');

      fireEvent.change(screen.getByLabelText('客户姓名'), {
        target: { value: '' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() =>
        expect(screen.queryByText('编辑带看')).not.toBeInTheDocument(),
      );
      fireEvent.click(await screen.findByRole('button', { name: '编辑' }));

      expect(screen.getByLabelText('客户姓名')).toHaveValue('李客户');
    });

    it('opens viewing creation drawer from house source', async () => {
      window.history.pushState({}, '', '/rental/viewings?house_id=99');

      renderPage(<ViewingsPage />);

      expect(await screen.findByText(/已带入房源/)).toBeInTheDocument();
      expect(screen.getByText('带看归属')).toBeInTheDocument();
      expect((await screen.findAllByText('客户信息')).length).toBeGreaterThan(
        0,
      );
      expect(screen.getByText('预约与结果')).toBeInTheDocument();
      expect(screen.queryByText('带看摘要')).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('客户姓名'), {
        target: { value: '赵客户' },
      });
      fireEvent.change(screen.getByLabelText('客户手机'), {
        target: { value: '13600000000' },
      });
      fireEvent.change(screen.getByLabelText('预约时间'), {
        target: { value: '2026-07-02T10:00' },
      });
      fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

      await waitFor(() =>
        expect(mockCreateViewingRecord).toHaveBeenCalledWith(
          expect.objectContaining({
            house_id: 99,
            customer_name: '赵客户',
          }),
        ),
      );
      await waitFor(() =>
        expect(mockListViewings).toHaveBeenCalledWith(
          expect.objectContaining({ house_id: 99 }),
        ),
      );
    });

    it('clears source house context when closing the viewing creation drawer', async () => {
      window.history.pushState({}, '', '/rental/viewings?house_id=99');

      renderPage(<ViewingsPage />);

      expect(await screen.findByText(/已带入房源/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      await waitFor(() => expect(window.location.search).toBe(''));
    });

    it('opens viewing creation drawer from tenant contact source', async () => {
      window.history.pushState({}, '', '/rental/viewings?contact_id=3');
      mockListContacts.mockResolvedValue({
        items: [
          { id: 3, name: '王租客', phone: '13700000000', roles: ['tenant'] },
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<ViewingsPage />);

      expect(
        await screen.findByText('已带入联系人，补齐房源和预约时间后保存。'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('客户姓名')).toHaveValue('王租客');
      expect(screen.getByLabelText('客户手机')).toHaveValue('13700000000');
    });

    it('opens viewing edit drawer directly from URL query', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/viewings?pending_lease=true&edit=4',
      );
      mockListViewings.mockResolvedValue({
        items: [viewingItem({ status: 'converted', signed_lease_id: null })],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<ViewingsPage />);

      expect(await screen.findByText('编辑带看')).toBeInTheDocument();
      expect(
        await screen.findByText(/该成交记录尚未绑定租客联系人/),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('客户姓名')).toHaveValue('李客户');
    });

    it('writes missing-contact task context to URL when opening the viewing drawer from the queue', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/viewings?pending_lease=true&contact_missing=true',
      );
      mockListViewings.mockResolvedValue({
        items: [viewingItem({ status: 'converted', signed_lease_id: null })],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<ViewingsPage />);

      expect(await screen.findByText(/李客户/)).toBeInTheDocument();
      const missingContactRow = (await screen.findByText('李客户')).closest(
        'tr',
      ) as HTMLElement;
      fireEvent.click(
        within(missingContactRow).getByRole('button', { name: '更多操作' }),
      );
      fireEvent.click(screen.getByText('补租客'));

      expect(await screen.findByText('编辑带看')).toBeInTheDocument();
      expect(
        screen.queryByText('当前操作：补齐租客主体'),
      ).not.toBeInTheDocument();
      await waitFor(() =>
        expect(window.location.search).toBe(
          '?pending_lease=true&contact_missing=true&edit=4&task=contact',
        ),
      );
    });

    it('clears focused viewing edit context when the drawer closes', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/viewings?pending_lease=true&contact_missing=true&edit=4&task=contact',
      );
      mockListViewings.mockResolvedValue({
        items: [viewingItem({ status: 'converted', signed_lease_id: null })],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<ViewingsPage />);

      expect(await screen.findByText('编辑带看')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      await waitFor(() =>
        expect(window.location.search).toBe(
          '?pending_lease=true&contact_missing=true',
        ),
      );
    });

    it('creates a tenant directly from the missing-contact viewing drawer and selects it', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/viewings?pending_lease=true&edit=4',
      );
      mockListContacts.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        page_size: 100,
      });
      mockListViewings.mockResolvedValue({
        items: [viewingItem({ status: 'converted', signed_lease_id: null })],
        total: 1,
        page: 1,
        page_size: 100,
      });
      mockCreateContact.mockResolvedValue({
        id: 8,
        name: '李客户',
        phone: '13900000000',
        roles: ['tenant'],
        is_active: true,
      });

      renderPage(<ViewingsPage />);

      expect(await screen.findByText('编辑带看')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '新建租客' }));

      expect(screen.getByLabelText('姓名')).toHaveValue('李客户');
      expect(screen.getByLabelText('手机')).toHaveValue('13900000000');
      fireEvent.click(screen.getByRole('button', { name: '保存租客' }));

      await waitFor(() =>
        expect(mockCreateContact).toHaveBeenCalledWith(
          expect.objectContaining({
            name: '李客户',
            phone: '13900000000',
            roles: ['tenant'],
            is_active: true,
          }),
        ),
      );
      expect(
        (await screen.findAllByText('李客户 / 13900000000')).at(-1),
      ).toBeDefined();
    });

    it('shows contact business actions for landlord and tenant roles', async () => {
      mockListContacts.mockResolvedValue({
        items: [
          { id: 3, name: '张房东', phone: '13800000000', roles: ['landlord'] },
          { id: 6, name: '王租客', phone: '13700000000', roles: ['tenant'] },
        ],
        total: 2,
        page: 1,
        page_size: 100,
      });

      renderPage(<ContactsPage />);

      expect(
        await screen.findByRole('link', { name: '登记房源' }),
      ).toHaveAttribute(
        'href',
        '/dashboard/rental/properties/new?landlord_id=3',
      );
      expect(screen.getByRole('link', { name: '登记带看' })).toHaveAttribute(
        'href',
        '/dashboard/rental/viewings?contact_id=6',
      );
    });

    it('shows landlord binding status and supports SMS invitation from contact actions', async () => {
      mockListContacts.mockResolvedValue({
        items: [
          {
            id: 3,
            name: '张房东',
            phone: '13800000000',
            roles: ['landlord'],
            landlord_binding_status: 'invited',
            landlord_invite_expires_at: '2026-09-01T12:00:00+08:00',
          },
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<ContactsPage />);

      expect(await screen.findByText('待接受')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '更多操作' }));
      fireEvent.click(screen.getByText('重新发送房东邀请'));
      expect(screen.getByText('邀请张房东绑定账号')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '短信发送' }));

      await waitFor(() =>
        expect(mockInviteLandlord).toHaveBeenCalledWith(3, 'sms'),
      );
      expect(await screen.findByText('房东邀请已生成')).toBeInTheDocument();
    });

    it('generates a landlord link for sharing through other channels', async () => {
      mockListContacts.mockResolvedValue({
        items: [
          {
            id: 3,
            name: '张房东',
            phone: '13800000000',
            roles: ['landlord'],
            landlord_binding_status: 'unbound',
          },
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<ContactsPage />);

      await screen.findByText('未绑定');
      fireEvent.click(screen.getByRole('button', { name: '更多操作' }));
      fireEvent.click(screen.getByText('邀请房东'));
      fireEvent.click(screen.getByRole('button', { name: '生成分享链接' }));

      await waitFor(() =>
        expect(mockInviteLandlord).toHaveBeenCalledWith(3, 'manual'),
      );
      expect(
        await screen.findByText('可通过微信、企微、邮件或其他渠道分享以下链接'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('房东邀请链接')).toHaveValue(
        'https://example.com/dashboard/landlord-invitations/test-token',
      );
    });
  });

  registerTestShard('rental-leases', () => {
    it('filters leases from the table search form', async () => {
      const { container } = renderPage(<LeasesPage />);

      await screen.findByText('租约列表');

      const quickQueueButtons = Array.from(
        container.querySelectorAll('button'),
      ).filter((button) =>
        ['全部', '待生效', '生效中', '已到期', '已终止'].some((label) =>
          (button.textContent || '').replace(/\s+/g, '').startsWith(label),
        ),
      );

      expect(quickQueueButtons).toHaveLength(0);
      fireEvent.change(screen.getByPlaceholderText('房源 / 租客 / 手机'), {
        target: { value: '王租客' },
      });
      fireEvent.keyDown(screen.getByPlaceholderText('房源 / 租客 / 手机'), {
        key: 'Enter',
        code: 'Enter',
      });

      await waitFor(() =>
        expect(mockListLeases).toHaveBeenCalledWith(
          expect.objectContaining({ keyword: '王租客', page: 1 }),
        ),
      );
      await waitFor(() =>
        expect(window.location.search).toBe(
          '?keyword=%E7%8E%8B%E7%A7%9F%E5%AE%A2',
        ),
      );
    });

    it('restores lease status and page filters from URL search params', async () => {
      window.history.pushState({}, '', '/rental/leases?status=active&page=2');
      mockListLeases.mockImplementation((params?: Record<string, unknown>) => {
        if (params?.status === 'pending') {
          return Promise.resolve({
            items: [],
            total: 1,
            page: 1,
            page_size: 1,
          });
        }
        if (
          params?.status === 'active' &&
          params?.page === 1 &&
          params?.page_size === 1
        ) {
          return Promise.resolve({
            items: [],
            total: 3,
            page: 1,
            page_size: 1,
          });
        }
        if (params?.status === 'expired') {
          return Promise.resolve({
            items: [],
            total: 0,
            page: 1,
            page_size: 1,
          });
        }
        if (
          params?.status === 'active' &&
          params?.page === 2 &&
          params?.page_size === 20
        ) {
          return Promise.resolve({
            items: [
              leaseItem({
                id: 6,
                house: houseItem({ id: 100, room_number: 'A-102' }),
                tenant: { id: 7, name: '李租客', phone: '13600000000' },
                start_date: '2026-06-01',
                end_date: '2027-05-31',
                monthly_rent: '4500.00',
                status: 'active',
                contract_files: [{ media_id: 9 }],
              }),
            ],
            total: 21,
            page: 2,
            page_size: 20,
          });
        }
        return Promise.resolve({
          items: [],
          total: 0,
          page: Number(params?.page || 1),
          page_size: Number(params?.page_size || 20),
        });
      });

      renderPage(<LeasesPage />);

      expect(screen.queryByText(/当前只看/)).not.toBeInTheDocument();
      expect(screen.queryByText('当前建议')).not.toBeInTheDocument();
      await waitFor(() =>
        expect(mockListLeases).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'active', page: 2 }),
        ),
      );
    });

    it('syncs lease status filter back to URL', async () => {
      renderPage(<LeasesPage />);

      fireEvent.mouseDown(await screen.findByRole('combobox'));
      fireEvent.click(
        (await screen.findAllByText('生效中')).at(-1) as HTMLElement,
      );

      await waitFor(() =>
        expect(window.location.search).toBe('?status=active'),
      );
      expect(window.location.search).toBe('?status=active');
    });

    it('restores lease filters on browser popstate', async () => {
      renderPage(<LeasesPage />);

      window.history.pushState({}, '', '/rental/leases?status=active&page=2');
      window.dispatchEvent(new PopStateEvent('popstate'));

      await waitFor(() =>
        expect(mockListLeases).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'active', page: 2 }),
        ),
      );
    });

    it('ignores the legacy missing-contract task because contracts are optional', async () => {
      window.history.pushState({}, '', '/rental/leases?task=contract');
      mockListLeases.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
      });

      renderPage(<LeasesPage />);

      expect(await screen.findByText('暂无租约')).toBeInTheDocument();
      await waitFor(() => {
        expect(mockListLeases).toHaveBeenCalled();
        expect(mockListLeases.mock.calls.at(-1)?.[0]).not.toHaveProperty(
          'contract_missing',
        );
      });
      expect(
        screen.getByRole('button', { name: '登记签约' }),
      ).toBeInTheDocument();
    });

    it('keeps the status filter while ignoring the legacy contract task', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/leases?task=contract&status=pending',
      );
      mockListLeases.mockImplementation((params?: Record<string, unknown>) => {
        if (params?.status === 'pending') {
          return Promise.resolve({
            items: [leaseItem({ status: 'pending' })],
            total: 1,
            page: 1,
            page_size: 100,
          });
        }
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: 1 });
      });

      renderPage(<LeasesPage />);

      await waitFor(() => {
        const params = mockListLeases.mock.calls.at(-1)?.[0];
        expect(params).toEqual(expect.objectContaining({ status: 'pending' }));
        expect(params).not.toHaveProperty('contract_missing');
      });
    });

    it('opens lease creation drawer from converted viewing source', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/leases?source_viewing_record_id=4',
      );
      mockListViewings.mockImplementation(
        (params?: Record<string, unknown>) => {
          if (params?.contact_missing === false) {
            return Promise.resolve({
              items: [
                viewingItem({
                  contact_id: 6,
                  contact: defaultTenant,
                  status: 'converted',
                  signed_lease_id: null,
                }),
              ],
              total: 1,
              page: 1,
              page_size: 100,
            });
          }
          return Promise.resolve({
            items: [
              viewingItem({
                contact_id: 6,
                contact: defaultTenant,
                status: 'converted',
                signed_lease_id: null,
              }),
            ],
            total: 1,
            page: 1,
            page_size: 100,
          });
        },
      );

      renderPage(<LeasesPage />);

      expect(
        await screen.findByText('李客户 / 星河湾花园 / 1 栋 / A-101'),
      ).toBeInTheDocument();
      expect(screen.getByText('租客资料')).toBeInTheDocument();
      expect(screen.getByText('租期与金额')).toBeInTheDocument();
      await waitFor(() =>
        expect(mockListViewings).toHaveBeenCalledWith(
          expect.objectContaining({
            pending_lease: true,
            contact_missing: false,
          }),
        ),
      );
      await waitFor(() =>
        expect(mockListViewings).toHaveBeenCalledWith(
          expect.objectContaining({ pending_lease: true }),
        ),
      );
    });

    it('opens lease edit drawer from edit query param', async () => {
      window.history.pushState({}, '', '/rental/leases?house_id=99&edit=5');

      renderPage(<LeasesPage />);

      expect(await screen.findByText('编辑租约')).toBeInTheDocument();
      expect(screen.getByLabelText('房源')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2026-07-01')).toBeInTheDocument();
    });

    it('clears edit query params when closing the lease edit drawer', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/leases?house_id=99&task=contract&edit=5',
      );

      renderPage(<LeasesPage />);

      expect(await screen.findByText('编辑租约')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      await waitFor(() =>
        expect(window.location.search).toBe('?house_id=99&task=contract'),
      );
    });

    it('opens a lease edit drawer without treating a legacy contract task as required work', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/leases?house_id=99&task=contract&edit=5',
      );
      mockListLeases.mockResolvedValue({
        items: [leaseItem()],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<LeasesPage />);

      expect(await screen.findByText('编辑租约')).toBeInTheDocument();
      await waitFor(() => {
        expect(mockListLeases.mock.calls.at(-1)?.[0]).not.toHaveProperty(
          'contract_missing',
        );
      });
    });

    it('opens lease edit drawer from edit query param even when the filtered list does not include the lease', async () => {
      window.history.pushState({}, '', '/rental/leases?house_id=99&edit=5');
      mockListLeases.mockImplementation((params?: Record<string, unknown>) => {
        if (
          params?.house_id === 99 &&
          !params?.status &&
          !params?.contract_missing
        ) {
          return Promise.resolve({
            items: [],
            total: 0,
            page: 1,
            page_size: 100,
          });
        }
        return Promise.resolve({ items: [], total: 0, page: 1, page_size: 1 });
      });

      renderPage(<LeasesPage />);

      expect(await screen.findByText('编辑租约')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2026-07-01')).toBeInTheDocument();
      await waitFor(() => expect(mockGetLease).toHaveBeenCalledWith(5));
    });

    it('clears source viewing query params when closing the lease creation drawer', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/leases?source_viewing_record_id=4',
      );
      mockListViewings.mockImplementation(
        (params?: Record<string, unknown>) => {
          if (params?.contact_missing === false) {
            return Promise.resolve({
              items: [
                viewingItem({
                  contact_id: 6,
                  contact: defaultTenant,
                  status: 'converted',
                  signed_lease_id: null,
                }),
              ],
              total: 1,
              page: 1,
              page_size: 100,
            });
          }
          return Promise.resolve({
            items: [
              viewingItem({
                contact_id: 6,
                contact: defaultTenant,
                status: 'converted',
                signed_lease_id: null,
              }),
            ],
            total: 1,
            page: 1,
            page_size: 100,
          });
        },
      );

      renderPage(<LeasesPage />);

      expect(
        await screen.findByText('李客户 / 星河湾花园 / 1 栋 / A-101'),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      await waitFor(() => expect(window.location.search).toBe(''));
    });

    it('warns when the source viewing has already been signed', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/leases?source_viewing_record_id=4',
      );
      mockListViewings.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        page_size: 100,
      });

      renderPage(<LeasesPage />);

      expect(
        await screen.findByText('该成交带看已生成租约，不能重复签约。'),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('已带入成交带看，补齐租期和金额后保存。'),
      ).not.toBeInTheDocument();
    });

    it('routes incomplete source viewings back to the viewing workflow before signing', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/leases?source_viewing_record_id=4',
      );
      mockListViewings.mockImplementation(
        (params?: Record<string, unknown>) => {
          if (params?.contact_missing === false) {
            return Promise.resolve({
              items: [],
              total: 0,
              page: 1,
              page_size: 100,
            });
          }
          return Promise.resolve({
            items: [
              viewingItem({ status: 'converted', signed_lease_id: null }),
            ],
            total: 1,
            page: 1,
            page_size: 100,
          });
        },
      );

      renderPage(<LeasesPage />);

      expect(
        await screen.findByText(
          '该成交带看未绑定租客联系人，请先回带看页补齐业务主体后再签约。',
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '去补租客' })).toHaveAttribute(
        'href',
        '/dashboard/rental/viewings?pending_lease=true&contact_missing=true&edit=4',
      );
      expect(
        screen.queryByText('已带入成交带看，补齐租期和金额后保存。'),
      ).not.toBeInTheDocument();
      expect(screen.queryByText('编辑租约')).not.toBeInTheDocument();
    });

    it('fills lease house and tenant from the selected converted viewing', async () => {
      mockListContacts.mockResolvedValue({
        items: [
          { id: 6, name: '王租客', phone: '13700000000', roles: ['tenant'] },
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });
      mockListViewings.mockResolvedValue({
        items: [
          viewingItem({
            contact_id: 6,
            contact: defaultTenant,
            status: 'converted',
            signed_lease_id: null,
          }),
        ],
        total: 1,
        page: 1,
        page_size: 100,
      });

      renderPage(<LeasesPage />);

      fireEvent.click(
        await screen.findByRole('button', { name: 'plus 登记签约' }),
      );
      expect(screen.queryByLabelText('成交带看')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '选择记录' }));
      fireEvent.mouseDown(screen.getByLabelText('成交带看'));
      const viewingOption = (
        await screen.findAllByText('李客户 / 星河湾花园 / 1 栋 / A-101')
      ).at(-1);
      expect(viewingOption).toBeDefined();
      fireEvent.click(viewingOption as HTMLElement);
      fireEvent.change(screen.getByLabelText('起租日期'), {
        target: { value: '2026-07-01' },
      });
      fireEvent.change(screen.getByLabelText('到期日期'), {
        target: { value: '2027-06-30' },
      });
      fireEvent.change(screen.getByLabelText('月租'), {
        target: { value: '4200' },
      });
      const submitSigningButton = screen.getByRole('button', {
        name: '确认成交并生效',
      });
      await waitFor(() => expect(submitSigningButton).toBeEnabled());
      fireEvent.click(submitSigningButton);

      await waitFor(() =>
        expect(mockCreateDealSigning).toHaveBeenCalledWith(
          expect.objectContaining({
            lease: expect.objectContaining({
              source_viewing_record_id: 4,
              house_id: 99,
              tenant_id: 6,
            }),
            team_id: null,
            beneficiary_user_ids: [101],
          }),
        ),
      );
    });

    it('uses the linked tenant from a source viewing', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/leases?source_viewing_record_id=4',
      );
      mockListContacts.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        page_size: 100,
      });
      mockListViewings.mockImplementation(
        (params?: Record<string, unknown>) => {
          if (params?.contact_missing === false) {
            return Promise.resolve({
              items: [
                viewingItem({
                  contact_id: 6,
                  contact: defaultTenant,
                  status: 'converted',
                  signed_lease_id: null,
                }),
              ],
              total: 1,
              page: 1,
              page_size: 100,
            });
          }
          return Promise.resolve({
            items: [
              viewingItem({
                contact_id: 6,
                contact: defaultTenant,
                status: 'converted',
                signed_lease_id: null,
              }),
            ],
            total: 1,
            page: 1,
            page_size: 100,
          });
        },
      );

      renderPage(<LeasesPage />);

      expect(
        await screen.findByText('李客户 / 星河湾花园 / 1 栋 / A-101'),
      ).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '选择已有租客' })).toBeChecked();
      expect(screen.getByLabelText('已有租客')).toBeInTheDocument();
    });

    it('submits a typed tenant identity through dedicated deal signing', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/leases?house_id=99&action=deal-signing',
      );

      renderPage(<LeasesPage />);

      expect(await screen.findByText('租客资料')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('租客姓名'), {
        target: { value: '王租客' },
      });
      fireEvent.change(screen.getByLabelText('手机号码'), {
        target: { value: '13700000000' },
      });
      fireEvent.change(screen.getByLabelText('起租日期'), {
        target: { value: '2026-07-01' },
      });
      fireEvent.change(screen.getByLabelText('到期日期'), {
        target: { value: '2027-06-30' },
      });
      fireEvent.change(screen.getByLabelText('月租'), {
        target: { value: '4200' },
      });
      const submitSigningButton = screen.getByRole('button', {
        name: '确认成交并生效',
      });
      await waitFor(() => expect(submitSigningButton).toBeEnabled());
      fireEvent.click(submitSigningButton);

      await waitFor(() =>
        expect(mockCreateDealSigning).toHaveBeenCalledWith(
          expect.objectContaining({
            lease: expect.objectContaining({
              house_id: 99,
              tenant_identity: {
                name: '王租客',
                phone: '13700000000',
              },
              start_date: '2026-07-01',
            }),
            team_id: null,
            beneficiary_user_ids: [101],
          }),
        ),
      );
      expect(mockCreateContact).not.toHaveBeenCalled();
      expect(mockCreateLease).not.toHaveBeenCalled();
    });

    it('clears lease draft values when reopening the create drawer', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/leases?house_id=99&action=deal-signing',
      );

      renderPage(<LeasesPage />);

      expect(await screen.findByText('租客资料')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('月租'), {
        target: { value: '4200' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(
        (await screen.findAllByText('放弃本次成交签约？')).length,
      ).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole('button', { name: '放弃填写' }));
      fireEvent.click(
        await screen.findByRole('button', { name: 'plus 登记签约' }),
      );

      await waitFor(() =>
        expect(document.querySelector('.ant-drawer-title')).toHaveTextContent(
          '登记签约',
        ),
      );
      expect(screen.getByLabelText('月租')).toHaveValue('');
    });

    it('opens lease creation drawer from house source', async () => {
      window.history.pushState({}, '', '/rental/leases?house_id=99');

      renderPage(<LeasesPage />);

      const houseSummary = await screen.findByTestId(
        'deal-signing-house-summary',
      );
      const tenantSectionTitle = screen.getByText('租客资料');
      expect(
        within(houseSummary).getByText('本次成交房源'),
      ).toBeInTheDocument();
      expect(
        houseSummary.compareDocumentPosition(tenantSectionTitle) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      await waitFor(() =>
        expect(mockListLeases).toHaveBeenCalledWith(
          expect.objectContaining({ house_id: 99 }),
        ),
      );
    });

    it('uses the start date as payment day and supports a two-month deposit preset', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/leases?house_id=99&action=deal-signing',
      );

      renderPage(<LeasesPage />);

      expect(await screen.findByText('租期与金额')).toBeInTheDocument();
      expect(screen.queryByLabelText('每月付款日')).not.toBeInTheDocument();
      expect(screen.getByText('押 1 月')).toBeInTheDocument();
      expect(screen.getByText('押 2 月')).toBeInTheDocument();
      expect(screen.getByText('押 3 月')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('租客姓名'), {
        target: { value: '王租客' },
      });
      fireEvent.change(screen.getByLabelText('手机号码'), {
        target: { value: '13700000000' },
      });
      fireEvent.change(screen.getByLabelText('起租日期'), {
        target: { value: '2026-07-15' },
      });
      fireEvent.change(screen.getByLabelText('月租'), {
        target: { value: '3650' },
      });
      fireEvent.click(screen.getByText('押 2 月'));

      await waitFor(() =>
        expect(screen.getByLabelText('押金')).toHaveValue('7300.00'),
      );
      fireEvent.click(screen.getByRole('button', { name: '确认成交并生效' }));

      await waitFor(() =>
        expect(mockCreateDealSigning).toHaveBeenCalledWith(
          expect.objectContaining({
            lease: expect.objectContaining({
              start_date: '2026-07-15',
              payment_day: 15,
              monthly_rent: '3650',
              deposit: '7300.00',
            }),
          }),
        ),
      );
    });

    it('shows the missing beneficiary validation message only once', async () => {
      mockUseModel.mockReturnValue({ initialState: {} });
      mockGetAllocationCapabilities.mockResolvedValue({
        submit: true,
        change_beneficiaries: true,
        view_scope: 'self',
        review: false,
        adjust: false,
        void: false,
        signing_teams: [],
      });

      renderPage(<EarningAttributionHarness />);

      expect(await screen.findByLabelText('收益归属')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '提交收益归属' }));

      await waitFor(() =>
        expect(screen.getAllByText('请至少选择一名收益受益人')).toHaveLength(1),
      );
    });

    it('can select an existing tenant in the deal signing drawer', async () => {
      window.history.pushState(
        {},
        '',
        '/rental/leases?house_id=99&action=deal-signing',
      );

      renderPage(<LeasesPage />);

      expect(await screen.findByText('租客资料')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('radio', { name: '选择已有租客' }));
      fireEvent.mouseDown(await screen.findByLabelText('已有租客'));
      const tenantOption = (
        await screen.findAllByText('张房东 / 13800000000')
      ).at(-1);
      expect(tenantOption).toBeDefined();
      fireEvent.click(tenantOption as HTMLElement);
      fireEvent.change(screen.getByLabelText('起租日期'), {
        target: { value: '2026-07-01' },
      });
      fireEvent.change(screen.getByLabelText('到期日期'), {
        target: { value: '2027-06-30' },
      });
      fireEvent.change(screen.getByLabelText('月租'), {
        target: { value: '4200' },
      });
      fireEvent.click(screen.getByRole('button', { name: '确认成交并生效' }));

      await waitFor(() =>
        expect(mockCreateDealSigning).toHaveBeenCalledWith(
          expect.objectContaining({
            lease: expect.objectContaining({
              house_id: 99,
              tenant_id: 3,
              start_date: '2026-07-01',
            }),
            team_id: null,
            beneficiary_user_ids: [101],
          }),
        ),
      );
    });
  });
});
