import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Checkbox,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import React, { useState } from 'react';
import {
  adminTableScroll,
  fixedPagePagination,
} from '@/pages/_shared/adminLayout';
import { buildingLabel, contactLabel } from '@/pages/rental/constants';
import { usePagedSelectOptions } from '@/pages/rental/usePagedSelectOptions';
import type {
  MigrationDecisions,
  MigrationIssue,
  MigrationOptions,
} from '@/services/manual/dataMigration';
import {
  dataMigrationApi,
  type MigrationRecord,
} from '@/services/manual/dataMigration';
import {
  appsHouseApiContactsListContacts,
  appsHouseApiPropertiesListBuildings,
} from '@/services/openapi/propertyRentalManagement';
import {
  entityLabels,
  errorMessage,
  fieldLabels,
  issueKey,
  issueValue,
  numericFields,
  setIssueDecision,
} from './presentation';

function StaffMappingTable({
  slug,
  batchId,
  decisions,
  members,
  saving,
  membersOnly,
  update,
}: {
  slug: string;
  batchId: string;
  decisions: MigrationDecisions;
  members: MigrationOptions['members'];
  saving: boolean;
  membersOnly: boolean;
  update: (next: MigrationDecisions) => void;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const staff = useQuery({
    queryKey: ['data-migration', slug, 'staff-mapping', batchId, page, search],
    queryFn: ({ signal }) =>
      dataMigrationApi.records(
        slug,
        batchId,
        {
          page,
          page_size: 20,
          entity_type: 'staff',
          search: search || undefined,
        },
        signal,
      ),
  });
  return (
    <Space orientation="vertical" className="w-full" size="small">
      <Input.Search
        aria-label="搜索历史员工"
        placeholder="旧员工姓名或编号"
        allowClear
        onSearch={(value) => {
          setSearch(value.trim());
          setPage(1);
        }}
      />
      {staff.isError && (
        <Alert
          type="error"
          showIcon
          title={errorMessage(staff.error, '历史员工读取失败')}
          action={<Button onClick={() => void staff.refetch()}>重试</Button>}
        />
      )}
      <Table<MigrationRecord>
        rowKey="id"
        dataSource={staff.data?.items || []}
        loading={staff.isLoading}
        scroll={adminTableScroll}
        pagination={fixedPagePagination(
          page,
          20,
          staff.data?.total || 0,
          setPage,
        )}
        locale={{ emptyText: '暂无匹配的历史员工' }}
        columns={[
          { title: '旧员工编号', dataIndex: 'source_id' },
          {
            title: '旧员工姓名',
            key: 'name',
            render: (_, record) =>
              String(
                record.data.realName ||
                  record.data.name ||
                  record.data.nickname ||
                  record.data.username ||
                  '未提供姓名',
              ),
          },
          {
            title: '来源删除状态',
            dataIndex: 'source_deleted',
            align: 'center',
            render: (value) => (value ? '旧版已删除' : '旧版未删除'),
          },
          {
            title: '绑定当前组织成员',
            key: 'mapping',
            width: 280,
            render: (_, record) => (
              <Select
                aria-label={`旧员工 ${record.source_id} 绑定成员`}
                allowClear
                value={decisions.member_mappings[record.source_id]}
                options={members.map((member) => ({
                  value: member.id,
                  label: member.name,
                }))}
                showSearch={{ optionFilterProp: 'label' }}
                onChange={(value) =>
                  update(
                    setIssueDecision(
                      decisions,
                      {
                        entity_type: 'staff',
                        source_id: record.source_id,
                        field: 'user_id',
                        code: '',
                        message: '',
                      },
                      value,
                    ),
                  )
                }
                disabled={
                  saving ||
                  (membersOnly &&
                    ['created', 'updated', 'reused', 'skipped'].includes(
                      record.state,
                    ))
                }
                placeholder="保留历史身份，暂不绑定"
                className="w-full"
              />
            ),
          },
        ]}
      />
    </Space>
  );
}

function EntityReferenceSelect({
  slug,
  field,
  value,
  onChange,
  disabled,
  label,
}: {
  slug: string;
  field: string;
  value: number | undefined;
  onChange: (value: unknown) => void;
  disabled: boolean;
  label: string;
}) {
  const buildings = usePagedSelectOptions({
    enabled: field === 'building_id',
    queryKey: ['data-migration', slug, 'building-options'],
    queryFn: (params) =>
      appsHouseApiPropertiesListBuildings(
        { ...params, scope: 'all' },
        { headers: { 'X-Org-Slug': slug } },
      ),
    selectedIds: [value],
    getOptionLabel: buildingLabel,
  });
  const landlords = usePagedSelectOptions({
    enabled: field === 'landlord_id',
    queryKey: ['data-migration', slug, 'landlord-options'],
    queryFn: (params) =>
      appsHouseApiContactsListContacts(
        { ...params, role: 'landlord', task: 'active' },
        { headers: { 'X-Org-Slug': slug } },
      ),
    selectedIds: [value],
    getOptionLabel: contactLabel,
  });
  const choices = field === 'building_id' ? buildings : landlords;
  return (
    <Space orientation="vertical" className="w-full" size={4}>
      <Select
        aria-label={label}
        value={value ?? undefined}
        onChange={onChange}
        disabled={disabled}
        className="w-full"
        allowClear
        options={choices.options}
        showSearch={choices.showSearch}
        loading={choices.loading}
        onPopupScroll={choices.onPopupScroll}
        onOpenChange={choices.onOpenChange}
        notFoundContent={choices.notFoundContent}
        placeholder="搜索并选择当前组织中的对象"
      />
      {choices.isError && (
        <Button size="small" onClick={() => void choices.refetch()}>
          重新读取可选对象
        </Button>
      )}
    </Space>
  );
}

export default function PrecheckEditor({
  slug,
  teamSourceId,
  batchId,
  membersOnly = false,
  issues,
  initialDecisions,
  members,
  saving,
  onSave,
  onDirty,
}: {
  slug: string;
  teamSourceId: string;
  batchId: string;
  membersOnly?: boolean;
  issues: MigrationIssue[];
  initialDecisions: MigrationDecisions;
  members: MigrationOptions['members'];
  saving: boolean;
  onSave: (decisions: MigrationDecisions) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [decisions, setDecisions] = useState(initialDecisions);
  const [staffId, setStaffId] = useState('');
  const [memberId, setMemberId] = useState<number>();
  const update = (next: MigrationDecisions) => {
    setDecisions(next);
    onDirty(true);
  };
  const memberOptions = members.map((member) => ({
    value: member.id,
    label: member.name,
  }));
  return (
    <Space orientation="vertical" size="middle" className="w-full">
      <Typography.Paragraph className="mb-0">
        {membersOnly
          ? '为尚未绑定的历史员工补充组织成员绑定。重新预检并确认后恢复可绑定的有效分配关系，已经成功绑定的员工及其他业务记录保持现状。'
          : '补全阻断字段，或明确选择当前组织中的已有对象进行复用。保存后会重新预检，预检通过后才能确认导入。'}
      </Typography.Paragraph>
      {!membersOnly && (
        <Space orientation="vertical" size={8}>
          {[
            { field: 'apply_name', label: '将旧团队名称应用到当前组织' },
            { field: 'apply_logo', label: '将旧团队标志应用到当前组织' },
          ].map(({ field, label }) => {
            const issue = {
              entity_type: 'team',
              source_id: String(teamSourceId),
              field,
              code: '',
              message: '',
            };
            return (
              <Checkbox
                key={field}
                checked={issueValue(decisions, issue) === true}
                disabled={saving}
                onChange={(event) =>
                  update(
                    setIssueDecision(decisions, issue, event.target.checked),
                  )
                }
              >
                {label}
              </Checkbox>
            );
          })}
          <Typography.Text type="secondary">
            默认保留当前组织名称与标志。已有标志达到数量上限时，旧标志保留在历史附件中。
          </Typography.Text>
        </Space>
      )}
      <Table<MigrationIssue>
        rowKey={issueKey}
        dataSource={
          membersOnly
            ? issues.filter((issue) => issue.field === 'user_id')
            : issues
        }
        pagination={false}
        scroll={adminTableScroll}
        locale={{ emptyText: '没有待处理的预检问题，可以核对汇总后确认导入。' }}
        columns={[
          {
            title: '数据类型 / 旧编号',
            key: 'source',
            render: (_, issue) =>
              `${entityLabels[issue.entity_type] || issue.entity_type} / ${issue.source_id}`,
          },
          {
            title: '需要处理的问题',
            dataIndex: 'message',
            width: 320,
            render: (value) => (
              <div className="whitespace-normal break-words">{value}</div>
            ),
          },
          {
            title: '补全或映射',
            key: 'edit',
            width: 280,
            render: (_, issue) => {
              const label = `${entityLabels[issue.entity_type] || issue.entity_type} ${issue.source_id} ${fieldLabels[issue.field] || issue.field}`;
              const value = issueValue(decisions, issue);
              const onChange = (next: unknown) =>
                update(setIssueDecision(decisions, issue, next));
              const candidates =
                issue.field === 'user_id'
                  ? memberOptions
                  : issue.candidates?.map((item) => ({
                      value: item.id,
                      label: item.label,
                    }));
              const location =
                value && typeof value === 'object'
                  ? (value as {
                      longitude?: number;
                      latitude?: number;
                      coordinate_system?: string;
                    })
                  : {};
              if (issue.field === 'complete')
                return (
                  <Typography.Text type="warning">
                    请在旧版解决导出异常，重新生成完整迁移包后上传。
                  </Typography.Text>
                );
              return (
                <Space orientation="vertical" className="w-full" size={4}>
                  <Typography.Text type="secondary">
                    {fieldLabels[issue.field] || issue.field}
                  </Typography.Text>
                  {issue.field === 'location' ? (
                    <>
                      <InputNumber
                        aria-label={`${label}经度`}
                        placeholder="经度"
                        min={-180}
                        max={180}
                        value={location.longitude}
                        onChange={(longitude) =>
                          onChange({
                            ...location,
                            longitude,
                            coordinate_system:
                              location.coordinate_system || 'gcj02',
                          })
                        }
                        disabled={saving}
                        className="w-full"
                      />
                      <InputNumber
                        aria-label={`${label}纬度`}
                        placeholder="纬度"
                        min={-90}
                        max={90}
                        value={location.latitude}
                        onChange={(latitude) =>
                          onChange({
                            ...location,
                            latitude,
                            coordinate_system:
                              location.coordinate_system || 'gcj02',
                          })
                        }
                        disabled={saving}
                        className="w-full"
                      />
                      <Select
                        aria-label={`${label}坐标系`}
                        value={location.coordinate_system || 'gcj02'}
                        options={[
                          { value: 'gcj02', label: '高德 / 腾讯坐标' },
                          { value: 'wgs84', label: 'GPS 坐标' },
                        ]}
                        onChange={(coordinate_system) =>
                          onChange({ ...location, coordinate_system })
                        }
                        disabled={saving}
                        className="w-full"
                      />
                      <Button
                        size="small"
                        disabled={saving}
                        onClick={() => onChange(null)}
                      >
                        清空旧坐标
                      </Button>
                      {value === null && (
                        <Typography.Text type="secondary">
                          已选择清空旧坐标
                        </Typography.Text>
                      )}
                    </>
                  ) : issue.field === 'migration_action' ||
                    issue.field === 'listing_type' ? (
                    <Select
                      aria-label={label}
                      className="w-full"
                      value={value as string | undefined}
                      options={
                        issue.field === 'migration_action'
                          ? [
                              { value: 'keep', label: '保留新版记录现状' },
                              {
                                value: 'update',
                                label: '按来源确认更新新版记录',
                              },
                            ]
                          : [
                              { value: 'whole', label: '整租' },
                              { value: 'shared', label: '合租' },
                              { value: 'apartment', label: '公寓' },
                              { value: 'short_term', label: '短租' },
                            ]
                      }
                      onChange={onChange}
                      disabled={saving}
                    />
                  ) : candidates?.length ||
                    issue.field === 'user_id' ||
                    issue.field === 'target_id' ? (
                    <Select
                      aria-label={label}
                      className="w-full"
                      allowClear
                      showSearch={{ optionFilterProp: 'label' }}
                      value={value as number | undefined}
                      options={candidates || []}
                      onChange={onChange}
                      disabled={saving}
                      placeholder="选择当前组织中的对象"
                    />
                  ) : issue.field === 'status' ? (
                    <Select
                      aria-label={label}
                      className="w-full"
                      value={value as string | undefined}
                      options={[
                        { value: 'paused', label: '暂不出租' },
                        { value: 'listed', label: '招租中' },
                        { value: 'rented', label: '已出租' },
                      ]}
                      onChange={onChange}
                      disabled={saving}
                    />
                  ) : ['building_id', 'landlord_id'].includes(issue.field) ? (
                    <EntityReferenceSelect
                      slug={slug}
                      field={issue.field}
                      value={value as number | undefined}
                      onChange={onChange}
                      disabled={saving}
                      label={label}
                    />
                  ) : numericFields.has(issue.field) ? (
                    <InputNumber
                      aria-label={label}
                      className="w-full"
                      value={value as number | undefined}
                      onChange={onChange}
                      disabled={saving}
                      precision={
                        ['asking_rent', 'area'].includes(issue.field) ? 2 : 0
                      }
                    />
                  ) : (
                    <Input
                      aria-label={label}
                      value={value == null ? '' : String(value)}
                      onChange={(event) => onChange(event.target.value)}
                      disabled={saving}
                    />
                  )}
                  {issue.field === 'landlord_id' && (
                    <>
                      <Button
                        size="small"
                        disabled={saving}
                        onClick={() => onChange(null)}
                      >
                        清空旧房东关联
                      </Button>
                      {value === null && (
                        <Typography.Text type="secondary">
                          已选择清空旧房东关联
                        </Typography.Text>
                      )}
                    </>
                  )}
                </Space>
              );
            },
          },
        ]}
      />
      {!membersOnly &&
        decisions.mappings.map((mapping) => {
          const issue = {
            entity_type: mapping.entity_type,
            source_id: mapping.source_id,
            field: 'migration_action',
            code: '',
            message: '',
          };
          return (
            <div
              key={`${mapping.entity_type}:${mapping.source_id}`}
              className="flex flex-col gap-2 md:flex-row md:items-center"
            >
              <Typography.Text>
                {entityLabels[mapping.entity_type] || mapping.entity_type}{' '}
                {mapping.source_id} → 新版记录 {mapping.target_id}
              </Typography.Text>
              <Select
                aria-label={`${entityLabels[mapping.entity_type] || mapping.entity_type} ${mapping.source_id} 复用处理方式`}
                value={(issueValue(decisions, issue) as string) || 'keep'}
                options={[
                  { value: 'keep', label: '保留新版记录现状' },
                  { value: 'update', label: '按来源确认更新新版记录' },
                ]}
                onChange={(value) =>
                  update(setIssueDecision(decisions, issue, value))
                }
                disabled={saving}
                className="w-full md:max-w-64"
              />
            </div>
          );
        })}
      <Typography.Text strong>历史员工与组织成员映射</Typography.Text>
      <Typography.Text type="secondary">
        同名员工不会自动绑定。未加入组织的员工可先邀请加入；保留历史身份不会创建账号或授予旧角色。
      </Typography.Text>
      <StaffMappingTable
        slug={slug}
        batchId={batchId}
        decisions={decisions}
        members={members}
        saving={saving}
        membersOnly={membersOnly}
        update={update}
      />
      {Object.entries(decisions.member_mappings).map(([sourceId, userId]) => (
        <Space key={sourceId} wrap>
          <Typography.Text>
            旧员工 {sourceId} →{' '}
            {members.find((member) => member.id === userId)?.name ||
              `成员 ${userId}`}
          </Typography.Text>
          <Button
            size="small"
            disabled={saving || membersOnly}
            onClick={() =>
              update(
                setIssueDecision(
                  decisions,
                  {
                    entity_type: 'staff',
                    source_id: sourceId,
                    field: 'user_id',
                    code: '',
                    message: '',
                  },
                  undefined,
                ),
              )
            }
          >
            取消映射
          </Button>
        </Space>
      ))}
      {!membersOnly && (
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            aria-label="旧员工编号"
            placeholder="旧员工编号"
            value={staffId}
            onChange={(event) => setStaffId(event.target.value)}
            className="md:max-w-48"
            disabled={saving}
          />
          <Select
            aria-label="映射到组织成员"
            placeholder="选择组织成员"
            value={memberId}
            onChange={setMemberId}
            options={memberOptions}
            showSearch={{ optionFilterProp: 'label' }}
            className="w-full md:max-w-64"
            disabled={saving}
          />
          <Button
            disabled={!staffId.trim() || !memberId || saving}
            onClick={() => {
              update(
                setIssueDecision(
                  decisions,
                  {
                    entity_type: 'staff',
                    source_id: staffId.trim(),
                    field: 'user_id',
                    code: '',
                    message: '',
                  },
                  memberId,
                ),
              );
              setStaffId('');
              setMemberId(undefined);
            }}
          >
            添加映射
          </Button>
        </div>
      )}
      <Button type="primary" loading={saving} onClick={() => onSave(decisions)}>
        {membersOnly ? '保存绑定并重新预检' : '保存补全并重新预检'}
      </Button>
    </Space>
  );
}
