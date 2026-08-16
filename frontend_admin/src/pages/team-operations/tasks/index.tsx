import {
  CheckSquareOutlined,
  InfoCircleOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  message,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import {
  AdminToolbar,
  adminTableScroll,
  drawerWidthMd,
  fixedPagePagination,
  fullWidthStyle,
  ResponsiveActions,
  wrapTextStyle,
} from '@/pages/_shared/adminLayout';
import {
  TenantSelectionGuard,
  useTenantWorkspace,
} from '@/pages/space/shared';
import {
  acceptTaskAssignment,
  cancelWorkTask,
  completeTaskAssignment,
  createWorkTask,
  getTaskAssignment,
  getTeamOperationsCapabilities,
  getWorkTask,
  listTaskAssignees,
  listTaskAssignments,
  listWorkTasks,
  rejectTaskAssignment,
  type TaskAssignment,
  type TaskPriority,
  type WorkTask,
  type WorkTaskInput,
} from '@/services/manual/teamOperations';
import { appsTeamsApiListTeams } from '@/services/openapi/teams';
import {
  assignmentStatusColor,
  invalidateTeamOperations,
  priorityColor,
  taskStatusColor,
  teamOperationsQueryKeys,
} from '../shared';
import { useStyles } from './styles';

const PAGE_SIZE = 10;

type TaskView = 'managed' | 'mine';
type TaskOwnership = number | 'organization';
type TaskFormValues = {
  team_id?: TaskOwnership;
  title: string;
  description?: string;
  priority: TaskPriority;
  due_at?: Dayjs;
  assignee_ids: number[];
};
type AssignmentAction = {
  action: 'complete' | 'reject';
  assignment: TaskAssignment;
};

function requestedId(name: string) {
  if (typeof window === 'undefined') return undefined;
  const value = Number(new URLSearchParams(window.location.search).get(name));
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

const TeamTasksPage: React.FC = () => {
  const { styles } = useStyles();
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const initialAssignmentId = useMemo(() => requestedId('assignment_id'), []);
  const initialTaskId = useMemo(() => requestedId('task_id'), []);
  const [view, setView] = useState<TaskView>(
    initialAssignmentId ? 'mine' : 'managed',
  );
  const [taskPage, setTaskPage] = useState(1);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<WorkTask>();
  const [selectedAssignment, setSelectedAssignment] =
    useState<TaskAssignment>();
  const [assignmentAction, setAssignmentAction] = useState<AssignmentAction>();
  const [taskForm] = Form.useForm<TaskFormValues>();
  const [actionForm] = Form.useForm<{ result?: string }>();
  const enabled = Boolean(workspace.selectedOrgSlug);
  const selectedOwnership = Form.useWatch('team_id', taskForm);

  const tasksQuery = useQuery({
    queryKey: teamOperationsQueryKeys.tasks(
      workspace.selectedOrgSlug,
      taskPage,
    ),
    queryFn: () => listWorkTasks({ page: taskPage, page_size: PAGE_SIZE }),
    enabled: enabled && view === 'managed',
  });
  const assignmentsQuery = useQuery({
    queryKey: teamOperationsQueryKeys.assignments(
      workspace.selectedOrgSlug,
      assignmentPage,
    ),
    queryFn: () =>
      listTaskAssignments({ page: assignmentPage, page_size: PAGE_SIZE }),
    enabled: enabled && view === 'mine',
  });
  const requestedAssignmentQuery = useQuery({
    queryKey: [
      'team-operations',
      'requested-assignment',
      workspace.selectedOrgSlug,
      initialAssignmentId,
    ],
    queryFn: () => {
      if (!initialAssignmentId) throw new Error('缺少任务分配 ID');
      return getTaskAssignment(initialAssignmentId);
    },
    enabled: enabled && Boolean(initialAssignmentId),
  });
  const requestedTaskQuery = useQuery({
    queryKey: [
      'team-operations',
      'requested-task',
      workspace.selectedOrgSlug,
      initialTaskId,
    ],
    queryFn: () => {
      if (!initialTaskId) throw new Error('缺少任务 ID');
      return getWorkTask(initialTaskId);
    },
    enabled: enabled && Boolean(initialTaskId),
  });
  const teamsQuery = useQuery({
    queryKey: ['tenant', 'teams', workspace.selectedOrgSlug, 'tasks'],
    queryFn: () => appsTeamsApiListTeams({ page: 1, page_size: 100 }),
    enabled,
  });
  const capabilitiesQuery = useQuery({
    queryKey: teamOperationsQueryKeys.capabilities(workspace.selectedOrgSlug),
    queryFn: () => getTeamOperationsCapabilities(),
    enabled,
  });
  const assigneesQuery = useQuery({
    queryKey: [
      'team-operations',
      'task-assignees',
      workspace.selectedOrgSlug,
      selectedOwnership,
    ],
    queryFn: () =>
      listTaskAssignees({
        page: 1,
        page_size: 100,
        team_id:
          typeof selectedOwnership === 'number' ? selectedOwnership : undefined,
      }),
    enabled: enabled && createOpen && selectedOwnership !== undefined,
  });

  useEffect(() => {
    if (!initialAssignmentId || selectedAssignment) return;
    if (requestedAssignmentQuery.data) {
      setSelectedAssignment(requestedAssignmentQuery.data);
    }
  }, [initialAssignmentId, requestedAssignmentQuery.data, selectedAssignment]);

  useEffect(() => {
    if (!initialTaskId || selectedTask) return;
    if (requestedTaskQuery.data) {
      setSelectedTask(requestedTaskQuery.data);
    }
  }, [initialTaskId, requestedTaskQuery.data, selectedTask]);

  const capabilities = capabilitiesQuery.data;
  const canManageTasks = Boolean(
    capabilities?.task_organization_manage ||
      capabilities?.task_team_ids.length,
  );
  const canShowManagedTasks = !capabilitiesQuery.isSuccess || canManageTasks;

  useEffect(() => {
    if (capabilitiesQuery.isSuccess && !canManageTasks && view === 'managed') {
      setView('mine');
    }
  }, [canManageTasks, capabilitiesQuery.isSuccess, view]);

  const createMutation = useMutation({
    mutationFn: (payload: WorkTaskInput) => createWorkTask(payload),
    onSuccess: async () => {
      message.success('任务已创建并通知执行人');
      setCreateOpen(false);
      taskForm.resetFields();
      await invalidateTeamOperations(queryClient);
    },
  });
  const cancelMutation = useMutation({
    mutationFn: (taskId: number) => cancelWorkTask(taskId),
    onSuccess: async (task) => {
      message.success('任务已取消');
      if (selectedTask?.id === task.id) setSelectedTask(task);
      await invalidateTeamOperations(queryClient);
    },
  });
  const acceptMutation = useMutation({
    mutationFn: (assignmentId: number) => acceptTaskAssignment(assignmentId),
    onSuccess: async (assignment) => {
      message.success('任务已接受');
      if (selectedAssignment?.id === assignment.id) {
        setSelectedAssignment(assignment);
      }
      await invalidateTeamOperations(queryClient);
    },
  });
  const assignmentActionMutation = useMutation({
    mutationFn: ({
      action,
      assignmentId,
      result,
    }: {
      action: AssignmentAction['action'];
      assignmentId: number;
      result: string;
    }) =>
      action === 'complete'
        ? completeTaskAssignment(assignmentId, result)
        : rejectTaskAssignment(assignmentId, result),
    onSuccess: async (assignment) => {
      message.success(
        assignment.status === 'completed' ? '任务已完成' : '任务已拒绝',
      );
      setAssignmentAction(undefined);
      actionForm.resetFields();
      if (selectedAssignment?.id === assignment.id) {
        setSelectedAssignment(assignment);
      }
      await invalidateTeamOperations(queryClient);
    },
  });

  const teams = teamsQuery.data?.items || [];
  const organizationManage = Boolean(capabilities?.task_organization_manage);
  const manageableTeams = useMemo(() => {
    const manageableTeamIds = new Set(capabilities?.task_team_ids || []);
    return teams.filter(
      (team) => organizationManage || manageableTeamIds.has(team.id),
    );
  }, [capabilities?.task_team_ids, organizationManage, teams]);
  const ownershipOptions = useMemo(() => {
    const options = [];
    if (organizationManage) {
      options.push({
        label: '组织级',
        options: [
          {
            label: '不指定团队（组织级）',
            value: 'organization' as TaskOwnership,
          },
        ],
      });
    }
    if (manageableTeams.length) {
      options.push({
        label: '团队',
        options: manageableTeams.map((team) => ({
          label: team.name,
          value: team.id,
        })),
      });
    }
    return options;
  }, [manageableTeams, organizationManage]);
  const availableOwnerships = useMemo(
    () => [
      ...(organizationManage ? (['organization'] as TaskOwnership[]) : []),
      ...manageableTeams.map((team) => team.id),
    ],
    [manageableTeams, organizationManage],
  );
  const defaultOwnership =
    availableOwnerships.length === 1 ? availableOwnerships[0] : undefined;
  const selectedTeam =
    typeof selectedOwnership === 'number'
      ? manageableTeams.find((team) => team.id === selectedOwnership)
      : undefined;
  const ownershipHelpText =
    selectedOwnership === 'organization'
      ? '未指定团队，下发成员可从当前组织中选择。'
      : selectedTeam
        ? `下发成员仅从「${selectedTeam.name}」团队成员中选择。`
        : '先选择所属团队，再选择下发成员。';
  const assigneePlaceholder =
    selectedOwnership === undefined
      ? '请先选择所属团队'
      : selectedOwnership === 'organization'
        ? '选择组织成员'
        : '选择团队成员';
  const memberOptions = useMemo(
    () =>
      (assigneesQuery.data?.items || []).map((user) => ({
        label: `${user.full_name || user.username} (${user.username})`,
        value: user.id,
      })),
    [assigneesQuery.data],
  );

  const taskColumns: ColumnsType<WorkTask> = [
    {
      title: '任务',
      dataIndex: 'title',
      width: 280,
      render: (_value, record) => (
        <Space orientation="vertical" size={2}>
          <Typography.Text strong style={wrapTextStyle}>
            {record.title}
          </Typography.Text>
          <Typography.Text type="secondary">
            {record.team_name || '组织级任务'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (_value, record) => (
        <Tag color={taskStatusColor(record.status)}>
          {record.status__mapping}
        </Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 110,
      render: (_value, record) => (
        <Tag color={priorityColor(record.priority)}>
          {record.priority__mapping}
        </Tag>
      ),
    },
    {
      title: '执行人',
      dataIndex: 'assignments',
      width: 260,
      render: (_value, record) => (
        <Space wrap size={[4, 4]}>
          {record.assignments.map((assignment) => (
            <Tag
              key={assignment.id}
              color={assignmentStatusColor(assignment.status)}
            >
              {assignment.assignee.full_name || assignment.assignee.username} ·{' '}
              {assignment.status__mapping}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '截止时间',
      dataIndex: 'due_at',
      width: 180,
      render: (value) =>
        value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '未设置',
    },
    {
      title: '操作',
      dataIndex: 'actions',
      fixed: 'right',
      width: 150,
      render: (_value, record) => (
        <ResponsiveActions>
          <a onClick={() => setSelectedTask(record)}>详情</a>
          {record.can_manage && record.status === 'active' ? (
            <Popconfirm
              title="确认取消该任务？"
              onConfirm={() => void cancelMutation.mutateAsync(record.id)}
            >
              <a>取消</a>
            </Popconfirm>
          ) : null}
        </ResponsiveActions>
      ),
    },
  ];

  const assignmentColumns: ColumnsType<TaskAssignment> = [
    {
      title: '我的任务',
      dataIndex: 'task_title',
      width: 280,
      render: (_value, record) => (
        <Space orientation="vertical" size={2}>
          <Typography.Text strong style={wrapTextStyle}>
            {record.task_title}
          </Typography.Text>
          <Typography.Text type="secondary">
            {record.team_name || '组织级任务'}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 160,
      render: (_value, record) => (
        <Space size={4}>
          <Tag color={assignmentStatusColor(record.status)}>
            {record.status__mapping}
          </Tag>
          {record.is_overdue ? <Tag color="red">已逾期</Tag> : null}
        </Space>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 110,
      render: (_value, record) => (
        <Tag color={priorityColor(record.priority)}>
          {record.priority__mapping}
        </Tag>
      ),
    },
    {
      title: '截止时间',
      dataIndex: 'due_at',
      width: 180,
      render: (value) =>
        value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '未设置',
    },
    {
      title: '操作',
      dataIndex: 'actions',
      fixed: 'right',
      width: 240,
      render: (_value, record) => (
        <ResponsiveActions>
          <a onClick={() => setSelectedAssignment(record)}>详情</a>
          {record.status === 'pending' ? (
            <>
              <a onClick={() => void acceptMutation.mutateAsync(record.id)}>
                接受
              </a>
              <a
                onClick={() => {
                  actionForm.resetFields();
                  setAssignmentAction({ action: 'reject', assignment: record });
                }}
              >
                拒绝
              </a>
            </>
          ) : null}
          {record.status === 'in_progress' ? (
            <a
              onClick={() => {
                actionForm.resetFields();
                setAssignmentAction({ action: 'complete', assignment: record });
              }}
            >
              完成
            </a>
          ) : null}
        </ResponsiveActions>
      ),
    },
  ];

  const submitTask = async (values: TaskFormValues) => {
    await createMutation.mutateAsync({
      team_id: values.team_id === 'organization' ? null : values.team_id,
      title: values.title.trim(),
      description: values.description?.trim() || '',
      task_type: 'general',
      priority: values.priority,
      due_at: values.due_at?.toISOString() || null,
      assignee_ids: values.assignee_ids,
      data: {},
    });
  };

  return (
    <TenantSelectionGuard title="团队任务">
      <Card
        extra={
          <AdminToolbar>
            <Segmented
              options={
                canShowManagedTasks
                  ? [
                      { label: '任务管理', value: 'managed' },
                      { label: '我的任务', value: 'mine' },
                    ]
                  : [{ label: '我的任务', value: 'mine' }]
              }
              value={view}
              onChange={(value) => setView(value as TaskView)}
            />
            {canManageTasks ? (
              <Button
                type="primary"
                onClick={() => {
                  taskForm.resetFields();
                  taskForm.setFieldsValue({
                    team_id: defaultOwnership,
                    priority: 'normal',
                    assignee_ids: [],
                  });
                  setCreateOpen(true);
                }}
              >
                新建任务
              </Button>
            ) : null}
          </AdminToolbar>
        }
      >
        {view === 'managed' ? (
          <Table<WorkTask>
            rowKey="id"
            loading={tasksQuery.isLoading}
            columns={taskColumns}
            dataSource={tasksQuery.data?.items || []}
            pagination={fixedPagePagination(
              tasksQuery.data?.page || taskPage,
              tasksQuery.data?.page_size || PAGE_SIZE,
              tasksQuery.data?.total || 0,
              setTaskPage,
            )}
            scroll={adminTableScroll}
          />
        ) : (
          <Table<TaskAssignment>
            rowKey="id"
            loading={assignmentsQuery.isLoading}
            columns={assignmentColumns}
            dataSource={assignmentsQuery.data?.items || []}
            pagination={fixedPagePagination(
              assignmentsQuery.data?.page || assignmentPage,
              assignmentsQuery.data?.page_size || PAGE_SIZE,
              assignmentsQuery.data?.total || 0,
              setAssignmentPage,
            )}
            scroll={adminTableScroll}
          />
        )}
      </Card>

      <Modal
        className={styles.createTaskModal}
        width={720}
        centered
        title={
          <div className={styles.createTaskTitle}>
            <span className={styles.createTaskTitleIcon}>
              <CheckSquareOutlined aria-hidden />
            </span>
            <div className={styles.createTaskTitleCopy}>
              <Typography.Text strong className={styles.createTaskTitleText}>
                下发团队任务
              </Typography.Text>
              <Typography.Text
                type="secondary"
                className={styles.createTaskSubtitle}
              >
                明确任务目标、执行成员与截止时间
              </Typography.Text>
            </div>
          </div>
        }
        open={createOpen}
        okText="创建并下发"
        cancelText="取消"
        confirmLoading={createMutation.isPending}
        okButtonProps={{
          icon: <SendOutlined aria-hidden />,
          className: styles.createTaskButton,
        }}
        cancelButtonProps={{ disabled: createMutation.isPending }}
        closable={!createMutation.isPending}
        keyboard={!createMutation.isPending}
        mask={{ closable: !createMutation.isPending }}
        onCancel={() => setCreateOpen(false)}
        onOk={() => taskForm.submit()}
        footer={(_originNode, { OkBtn, CancelBtn }) => (
          <div className={styles.createTaskFooter}>
            <Space size={8}>
              <CancelBtn />
              <OkBtn />
            </Space>
          </div>
        )}
      >
        <Form<TaskFormValues>
          form={taskForm}
          layout="vertical"
          className={styles.createTaskForm}
          onFinish={(values) => void submitTask(values)}
        >
          <section
            className={styles.taskSection}
            aria-labelledby="task-content-heading"
          >
            <Typography.Title
              level={5}
              id="task-content-heading"
              className={styles.taskSectionTitle}
            >
              填写任务内容
            </Typography.Title>
            <Form.Item
              label="任务标题"
              name="title"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: '请输入任务标题',
                },
              ]}
            >
              <Input
                allowClear
                maxLength={255}
                showCount
                placeholder="用一句话说明需要完成的工作"
              />
            </Form.Item>
            <Form.Item label="任务说明（可选）" name="description">
              <Input.TextArea
                allowClear
                maxLength={2000}
                showCount
                rows={2}
                placeholder="补充任务背景、完成标准或注意事项"
              />
            </Form.Item>
            <div className={styles.taskFieldsGrid}>
              <Form.Item
                label="优先级"
                name="priority"
                rules={[{ required: true, message: '请选择优先级' }]}
              >
                <Select
                  options={[
                    { label: '普通', value: 'normal' },
                    { label: '重要', value: 'high' },
                    { label: '紧急', value: 'urgent' },
                  ]}
                />
              </Form.Item>
              <Form.Item label="截止时间（可选）" name="due_at">
                <DatePicker
                  showTime
                  style={fullWidthStyle}
                  placeholder="选择截止日期与时间"
                />
              </Form.Item>
            </div>
          </section>

          <section
            className={styles.taskSection}
            aria-labelledby="task-assignees-heading"
          >
            <Typography.Title
              level={5}
              id="task-assignees-heading"
              className={styles.taskSectionTitle}
            >
              选择下发范围
            </Typography.Title>
            <Form.Item
              label="所属团队"
              name="team_id"
              rules={[{ required: true, message: '请选择所属团队' }]}
            >
              <Select
                loading={teamsQuery.isLoading || capabilitiesQuery.isLoading}
                options={ownershipOptions}
                placeholder="选择团队或设为组织级任务"
                onChange={() => taskForm.setFieldValue('assignee_ids', [])}
              />
            </Form.Item>
            <div className={styles.ownershipHint}>
              <InfoCircleOutlined aria-hidden />
              <Typography.Text>{ownershipHelpText}</Typography.Text>
            </div>
            <Form.Item
              label="下发成员"
              name="assignee_ids"
              rules={[{ required: true, message: '请选择至少一名下发成员' }]}
              extra="每位成员都会收到独立任务，可分别接受和完成。"
            >
              <Select
                mode="multiple"
                disabled={selectedOwnership === undefined}
                loading={assigneesQuery.isLoading}
                options={memberOptions}
                placeholder={assigneePlaceholder}
                showSearch={{ optionFilterProp: 'label' }}
              />
            </Form.Item>
          </section>
        </Form>
      </Modal>

      <Modal
        title={
          assignmentAction?.action === 'complete' ? '完成任务' : '拒绝任务'
        }
        open={Boolean(assignmentAction)}
        okText="确认"
        cancelText="取消"
        confirmLoading={assignmentActionMutation.isPending}
        onCancel={() => setAssignmentAction(undefined)}
        onOk={() => actionForm.submit()}
      >
        <Form
          form={actionForm}
          layout="vertical"
          onFinish={(values: { result?: string }) => {
            if (!assignmentAction) return;
            void assignmentActionMutation.mutateAsync({
              action: assignmentAction.action,
              assignmentId: assignmentAction.assignment.id,
              result: values.result?.trim() || '',
            });
          }}
        >
          <Form.Item
            label={
              assignmentAction?.action === 'complete' ? '完成说明' : '拒绝原因'
            }
            name="result"
          >
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="任务详情"
        open={Boolean(selectedTask)}
        size={drawerWidthMd}
        onClose={() => setSelectedTask(undefined)}
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="标题">
            {selectedTask?.title || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="团队">
            {selectedTask?.team_name || '组织级任务'}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {selectedTask ? (
              <Tag color={taskStatusColor(selectedTask.status)}>
                {selectedTask.status__mapping}
              </Tag>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="优先级">
            {selectedTask ? (
              <Tag color={priorityColor(selectedTask.priority)}>
                {selectedTask.priority__mapping}
              </Tag>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="截止时间">
            {selectedTask?.due_at
              ? dayjs(selectedTask.due_at).format('YYYY-MM-DD HH:mm')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="任务说明">
            <Typography.Paragraph style={wrapTextStyle}>
              {selectedTask?.description || '-'}
            </Typography.Paragraph>
          </Descriptions.Item>
          <Descriptions.Item label="执行情况">
            <Space orientation="vertical" size={4}>
              {(selectedTask?.assignments || []).map((assignment) => (
                <Tag
                  key={assignment.id}
                  color={assignmentStatusColor(assignment.status)}
                >
                  {assignment.assignee.full_name ||
                    assignment.assignee.username}{' '}
                  · {assignment.status__mapping}
                </Tag>
              ))}
            </Space>
          </Descriptions.Item>
        </Descriptions>
      </Drawer>

      <Drawer
        title="我的任务详情"
        open={Boolean(selectedAssignment)}
        size={drawerWidthMd}
        onClose={() => setSelectedAssignment(undefined)}
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="标题">
            {selectedAssignment?.task_title || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="团队">
            {selectedAssignment?.team_name || '组织级任务'}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {selectedAssignment ? (
              <Tag color={assignmentStatusColor(selectedAssignment.status)}>
                {selectedAssignment.status__mapping}
              </Tag>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="截止时间">
            {selectedAssignment?.due_at
              ? dayjs(selectedAssignment.due_at).format('YYYY-MM-DD HH:mm')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="任务说明">
            <Typography.Paragraph style={wrapTextStyle}>
              {selectedAssignment?.task_description || '-'}
            </Typography.Paragraph>
          </Descriptions.Item>
          <Descriptions.Item label="处理结果">
            {selectedAssignment?.result || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Drawer>
    </TenantSelectionGuard>
  );
};

export default TeamTasksPage;
