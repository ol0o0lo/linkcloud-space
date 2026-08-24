import {
  CheckSquareOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  message,
  Popconfirm,
  Radio,
  Segmented,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import {
  adminTableScroll,
  drawerWidthMd,
  fixedPagePagination,
  fullWidthStyle,
  ResponsiveActions,
  wrapTextStyle,
} from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/space/shared';
import {
  acceptTaskAssignment,
  cancelWorkTask,
  completeTaskAssignment,
  createWorkTask,
  getTaskAssignment,
  getTaskAssignmentSummary,
  getTeamOperationsCapabilities,
  getWorkTask,
  getWorkTaskSummary,
  listTaskAssignees,
  listTaskAssignments,
  listWorkTasks,
  rejectTaskAssignment,
  type TaskAssignment,
  type TaskAssignmentStatus,
  type TaskDueState,
  type TaskPriority,
  type WorkTask,
  type WorkTaskInput,
  type WorkTaskStatus,
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
type TaskMetricKey = 'all' | 'active' | 'pending' | 'due_soon' | 'overdue';
type TaskFilterState<TStatus extends string> = {
  status?: TStatus;
  priority?: TaskPriority;
  team_id?: number;
  due_state?: TaskDueState;
  keyword?: string;
};
type TaskFormValues = {
  team_id?: number;
  is_organization_task?: boolean;
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

const EMPTY_MANAGED_FILTERS: TaskFilterState<WorkTaskStatus> = {};
const EMPTY_ASSIGNMENT_FILTERS: TaskFilterState<TaskAssignmentStatus> = {};

function personLabel(
  person?: { full_name?: string; username?: string } | null,
) {
  return person?.full_name || person?.username || '-';
}

function personInitial(
  person?: { full_name?: string; username?: string } | null,
) {
  const label = personLabel(person);
  return label === '-' ? '?' : label.trim().slice(0, 1).toUpperCase();
}

function deadlineMeta(value?: string | null, isOverdue = false) {
  if (!value) return { absolute: '-', relative: undefined };
  const deadline = dayjs(value);
  const minutes = deadline.diff(dayjs(), 'minute');
  if (isOverdue) {
    const overdueMinutes = Math.abs(minutes);
    return {
      absolute: deadline.format('YYYY-MM-DD HH:mm'),
      relative:
        overdueMinutes >= 1440
          ? `已逾期 ${Math.ceil(overdueMinutes / 1440)} 天`
          : `已逾期 ${Math.max(1, Math.ceil(overdueMinutes / 60))} 小时`,
    };
  }
  if (minutes < 0) {
    return {
      absolute: deadline.format('YYYY-MM-DD HH:mm'),
      relative: undefined,
    };
  }
  if (minutes <= 1440) {
    return {
      absolute: deadline.format('YYYY-MM-DD HH:mm'),
      relative:
        minutes >= 60
          ? `剩余 ${Math.max(1, Math.ceil(minutes / 60))} 小时`
          : `剩余 ${Math.max(1, minutes)} 分钟`,
    };
  }
  return { absolute: deadline.format('YYYY-MM-DD HH:mm'), relative: undefined };
}

function requestedId(name: string) {
  if (typeof window === 'undefined') return undefined;
  const value = Number(new URLSearchParams(window.location.search).get(name));
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function removeRequestedIdFromSearch(name: string) {
  if (typeof window === 'undefined') return;
  const search = new URLSearchParams(window.location.search);
  if (!search.has(name)) return;

  search.delete(name);
  const nextSearch = search.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
  window.history.replaceState(window.history.state, '', nextUrl);
}

const TeamTasksPage: React.FC = () => {
  const { styles } = useStyles();
  const workspace = useTenantWorkspace();
  const queryClient = useQueryClient();
  const [requestedAssignmentId, setRequestedAssignmentId] = useState(() =>
    requestedId('assignment_id'),
  );
  const [requestedTaskId, setRequestedTaskId] = useState(() =>
    requestedId('task_id'),
  );
  const [view, setView] = useState<TaskView>(
    requestedAssignmentId ? 'mine' : 'managed',
  );
  const [taskPage, setTaskPage] = useState(1);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [taskFilters, setTaskFilters] = useState<
    TaskFilterState<WorkTaskStatus>
  >(EMPTY_MANAGED_FILTERS);
  const [assignmentFilters, setAssignmentFilters] = useState<
    TaskFilterState<TaskAssignmentStatus>
  >(EMPTY_ASSIGNMENT_FILTERS);
  const [taskKeywordInput, setTaskKeywordInput] = useState('');
  const [assignmentKeywordInput, setAssignmentKeywordInput] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<WorkTask>();
  const [selectedAssignment, setSelectedAssignment] =
    useState<TaskAssignment>();
  const [assignmentAction, setAssignmentAction] = useState<AssignmentAction>();
  const [taskForm] = Form.useForm<TaskFormValues>();
  const [actionForm] = Form.useForm<{ result?: string }>();
  const enabled = Boolean(workspace.selectedOrgSlug);
  const selectedTeamId = Form.useWatch('team_id', taskForm);
  const isOrganizationTask = Boolean(
    Form.useWatch('is_organization_task', taskForm),
  );
  const selectedOwnership: TaskOwnership | undefined = isOrganizationTask
    ? 'organization'
    : selectedTeamId;

  const taskSummaryFilters = useMemo(
    () => ({
      team_id: taskFilters.team_id,
      priority: taskFilters.priority,
      keyword: taskFilters.keyword,
    }),
    [taskFilters.keyword, taskFilters.priority, taskFilters.team_id],
  );
  const assignmentSummaryFilters = useMemo(
    () => ({
      team_id: assignmentFilters.team_id,
      priority: assignmentFilters.priority,
      keyword: assignmentFilters.keyword,
    }),
    [
      assignmentFilters.keyword,
      assignmentFilters.priority,
      assignmentFilters.team_id,
    ],
  );

  const tasksQuery = useQuery({
    queryKey: teamOperationsQueryKeys.tasks(
      workspace.selectedOrgSlug,
      taskPage,
      taskFilters,
    ),
    queryFn: () =>
      listWorkTasks({
        page: taskPage,
        page_size: PAGE_SIZE,
        ...taskFilters,
      }),
    enabled: enabled && view === 'managed',
    placeholderData: (previousData) => previousData,
  });
  const taskSummaryQuery = useQuery({
    queryKey: teamOperationsQueryKeys.taskSummary(
      workspace.selectedOrgSlug,
      taskSummaryFilters,
    ),
    queryFn: () => getWorkTaskSummary(taskSummaryFilters),
    enabled: enabled && view === 'managed',
  });
  const assignmentsQuery = useQuery({
    queryKey: teamOperationsQueryKeys.assignments(
      workspace.selectedOrgSlug,
      assignmentPage,
      assignmentFilters,
    ),
    queryFn: () =>
      listTaskAssignments({
        page: assignmentPage,
        page_size: PAGE_SIZE,
        ...assignmentFilters,
      }),
    enabled: enabled && view === 'mine',
    placeholderData: (previousData) => previousData,
  });
  const assignmentSummaryQuery = useQuery({
    queryKey: teamOperationsQueryKeys.assignmentSummary(
      workspace.selectedOrgSlug,
      assignmentSummaryFilters,
    ),
    queryFn: () => getTaskAssignmentSummary(assignmentSummaryFilters),
    enabled: enabled && view === 'mine',
  });
  const requestedAssignmentQuery = useQuery({
    queryKey: [
      'team-operations',
      'requested-assignment',
      workspace.selectedOrgSlug,
      requestedAssignmentId,
    ],
    queryFn: () => {
      if (!requestedAssignmentId) throw new Error('缺少任务分配 ID');
      return getTaskAssignment(requestedAssignmentId);
    },
    enabled: enabled && Boolean(requestedAssignmentId),
  });
  const requestedTaskQuery = useQuery({
    queryKey: [
      'team-operations',
      'requested-task',
      workspace.selectedOrgSlug,
      requestedTaskId,
    ],
    queryFn: () => {
      if (!requestedTaskId) throw new Error('缺少任务 ID');
      return getWorkTask(requestedTaskId);
    },
    enabled: enabled && Boolean(requestedTaskId),
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
    if (!requestedAssignmentId || selectedAssignment) return;
    if (requestedAssignmentQuery.data) {
      setSelectedAssignment(requestedAssignmentQuery.data);
    }
  }, [
    requestedAssignmentId,
    requestedAssignmentQuery.data,
    selectedAssignment,
  ]);

  useEffect(() => {
    if (!requestedTaskId || selectedTask) return;
    if (requestedTaskQuery.data) {
      setSelectedTask(requestedTaskQuery.data);
    }
  }, [requestedTaskId, requestedTaskQuery.data, selectedTask]);

  const closeTaskDetail = () => {
    setSelectedTask(undefined);
    setRequestedTaskId(undefined);
    removeRequestedIdFromSearch('task_id');
  };

  const closeAssignmentDetail = () => {
    setSelectedAssignment(undefined);
    setRequestedAssignmentId(undefined);
    removeRequestedIdFromSearch('assignment_id');
  };

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
  const manageableTeamOptions = useMemo(
    () =>
      manageableTeams.map((team) => ({
        label: team.name,
        value: team.id,
      })),
    [manageableTeams],
  );
  const teamFilterOptions = useMemo(
    () =>
      teams.map((team) => ({
        label: team.name,
        value: team.id,
      })),
    [teams],
  );
  const availableOwnerships = useMemo(
    () => [
      ...(organizationManage ? (['organization'] as TaskOwnership[]) : []),
      ...manageableTeams.map((team) => team.id),
    ],
    [manageableTeams, organizationManage],
  );
  const defaultOwnership =
    availableOwnerships.length === 1 ? availableOwnerships[0] : undefined;
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

  const applyTaskFilters = (
    patch: Partial<TaskFilterState<WorkTaskStatus>>,
  ) => {
    setTaskPage(1);
    setTaskFilters((current) => ({ ...current, ...patch }));
  };
  const applyAssignmentFilters = (
    patch: Partial<TaskFilterState<TaskAssignmentStatus>>,
  ) => {
    setAssignmentPage(1);
    setAssignmentFilters((current) => ({ ...current, ...patch }));
  };
  const resetTaskFilters = () => {
    setTaskPage(1);
    setTaskKeywordInput('');
    setTaskFilters(EMPTY_MANAGED_FILTERS);
  };
  const resetAssignmentFilters = () => {
    setAssignmentPage(1);
    setAssignmentKeywordInput('');
    setAssignmentFilters(EMPTY_ASSIGNMENT_FILTERS);
  };
  const selectManagedMetric = (metric: TaskMetricKey) => {
    if (metric === 'all') {
      applyTaskFilters({ status: undefined, due_state: undefined });
      return;
    }
    if (metric === 'active') {
      applyTaskFilters({ status: 'active', due_state: undefined });
      return;
    }
    applyTaskFilters({ status: 'active', due_state: metric as TaskDueState });
  };
  const selectAssignmentMetric = (metric: TaskMetricKey) => {
    if (metric === 'pending' || metric === 'active') {
      applyAssignmentFilters({
        status: metric === 'pending' ? 'pending' : 'in_progress',
        due_state: undefined,
      });
      return;
    }
    applyAssignmentFilters({
      status: undefined,
      due_state: metric as TaskDueState,
    });
  };
  const activeManagedMetric: TaskMetricKey | undefined = taskFilters.due_state
    ? taskFilters.due_state
    : taskFilters.status === 'active'
      ? 'active'
      : taskFilters.status
        ? undefined
        : 'all';
  const activeAssignmentMetric: TaskMetricKey | undefined =
    assignmentFilters.due_state ||
    (assignmentFilters.status === 'pending'
      ? 'pending'
      : assignmentFilters.status === 'in_progress'
        ? 'active'
        : undefined);

  const taskStatusOptions = [
    { label: '进行中', value: 'active' },
    { label: '已完成', value: 'completed' },
    { label: '已取消', value: 'cancelled' },
  ];
  const assignmentStatusOptions = [
    { label: '待接受', value: 'pending' },
    { label: '进行中', value: 'in_progress' },
    { label: '已完成', value: 'completed' },
    { label: '已拒绝', value: 'rejected' },
    { label: '已取消', value: 'cancelled' },
  ];
  const priorityOptions = [
    { label: '普通', value: 'normal' },
    { label: '重要', value: 'high' },
    { label: '紧急', value: 'urgent' },
  ];
  const dueStateOptions = [
    { label: '24 小时内到期', value: 'due_soon' },
    { label: '已逾期', value: 'overdue' },
  ];

  const taskColumns: ColumnsType<WorkTask> = [
    {
      title: '任务标题',
      dataIndex: 'title',
      width: 170,
      render: (_value, record) => (
        <div className={styles.taskTitleCell}>
          <Typography.Text strong className={styles.taskTitleText}>
            {record.title}
          </Typography.Text>
          <Typography.Text
            type="secondary"
            className={styles.taskDescription}
            title={record.description || '暂无任务说明'}
          >
            {record.description || '暂无任务说明'}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '所属团队',
      dataIndex: 'team_name',
      width: 90,
      render: (_value, record) => (
        <Typography.Text>{record.team_name || '组织级任务'}</Typography.Text>
      ),
    },
    {
      title: '执行成员',
      dataIndex: 'assignments',
      width: 90,
      render: (_value, record) => {
        if (!record.assignments.length) return '-';
        return (
          <div className={styles.assigneeCell}>
            <Avatar.Group size="small" max={{ count: 3 }}>
              {record.assignments.map((assignment) => (
                <Tooltip
                  key={assignment.id}
                  title={`${personLabel(assignment.assignee)} · ${assignment.status__mapping}`}
                >
                  <Avatar>{personInitial(assignment.assignee)}</Avatar>
                </Tooltip>
              ))}
            </Avatar.Group>
          </div>
        );
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 76,
      align: 'center',
      render: (_value, record) => (
        <Tag className={styles.listTag} color={priorityColor(record.priority)}>
          {record.priority__mapping}
        </Tag>
      ),
    },
    {
      title: '截止时间',
      dataIndex: 'due_at',
      width: 136,
      align: 'center',
      render: (value, record) => {
        const isOverdue = Boolean(
          value && record.status === 'active' && dayjs(value).isBefore(dayjs()),
        );
        const meta = deadlineMeta(value, isOverdue);
        return (
          <div className={styles.deadlineCell}>
            <Typography.Text>{meta.absolute}</Typography.Text>
            {meta.relative ? (
              <Typography.Text type={isOverdue ? 'danger' : 'warning'}>
                {meta.relative}
              </Typography.Text>
            ) : null}
          </div>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 76,
      align: 'center',
      render: (_value, record) => {
        const isOverdue = Boolean(
          record.due_at &&
            record.status === 'active' &&
            dayjs(record.due_at).isBefore(dayjs()),
        );
        return isOverdue ? (
          <Tag className={styles.listTag} color="red">
            已逾期
          </Tag>
        ) : (
          <Tag
            className={styles.listTag}
            color={taskStatusColor(record.status)}
          >
            {record.status__mapping}
          </Tag>
        );
      },
    },
    {
      title: '创建人',
      dataIndex: 'creator',
      width: 70,
      render: (_value, record) => personLabel(record.creator),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 92,
      align: 'center',
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
      title: '任务标题',
      dataIndex: 'task_title',
      width: 200,
      render: (_value, record) => (
        <div className={styles.taskTitleCell}>
          <Typography.Text strong className={styles.taskTitleText}>
            {record.task_title}
          </Typography.Text>
          <Typography.Text
            type="secondary"
            className={styles.taskDescription}
            title={record.task_description || '暂无任务说明'}
          >
            {record.task_description || '暂无任务说明'}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '所属团队',
      dataIndex: 'team_name',
      width: 90,
      render: (_value, record) => (
        <Typography.Text>{record.team_name || '组织级任务'}</Typography.Text>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 76,
      align: 'center',
      render: (_value, record) => (
        <Tag className={styles.listTag} color={priorityColor(record.priority)}>
          {record.priority__mapping}
        </Tag>
      ),
    },
    {
      title: '截止时间',
      dataIndex: 'due_at',
      width: 136,
      align: 'center',
      render: (value, record) => {
        const meta = deadlineMeta(value, record.is_overdue);
        return (
          <div className={styles.deadlineCell}>
            <Typography.Text>{meta.absolute}</Typography.Text>
            {meta.relative ? (
              <Typography.Text type={record.is_overdue ? 'danger' : 'warning'}>
                {meta.relative}
              </Typography.Text>
            ) : null}
          </div>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 76,
      align: 'center',
      render: (_value, record) =>
        record.is_overdue ? (
          <Tag className={styles.listTag} color="red">
            已逾期
          </Tag>
        ) : (
          <Tag
            className={styles.listTag}
            color={assignmentStatusColor(record.status)}
          >
            {record.status__mapping}
          </Tag>
        ),
    },
    {
      title: '创建人',
      dataIndex: 'creator',
      width: 70,
      render: (_value, record) => personLabel(record.creator),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 150,
      align: 'center',
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

  const summaryMetrics =
    view === 'managed'
      ? [
          {
            key: 'all' as const,
            label: '全部任务',
            value: taskSummaryQuery.data?.total,
            description: '当前筛选范围内',
            icon: <CheckSquareOutlined />,
            tone: styles.metricBlue,
          },
          {
            key: 'active' as const,
            label: '进行中',
            value: taskSummaryQuery.data?.active,
            description: '当前仍在执行',
            icon: <PlayCircleOutlined />,
            tone: styles.metricGreen,
          },
          {
            key: 'due_soon' as const,
            label: '24 小时内到期',
            value: taskSummaryQuery.data?.due_soon,
            description: '不包含已逾期',
            icon: <ClockCircleOutlined />,
            tone: styles.metricOrange,
          },
          {
            key: 'overdue' as const,
            label: '已逾期',
            value: taskSummaryQuery.data?.overdue,
            description: '需要尽快处理',
            icon: <ExclamationCircleOutlined />,
            tone: styles.metricRed,
          },
        ]
      : [
          {
            key: 'pending' as const,
            label: '待接受',
            value: assignmentSummaryQuery.data?.pending,
            description: '等待你确认',
            icon: <CheckSquareOutlined />,
            tone: styles.metricBlue,
          },
          {
            key: 'active' as const,
            label: '进行中',
            value: assignmentSummaryQuery.data?.in_progress,
            description: '当前正在处理',
            icon: <PlayCircleOutlined />,
            tone: styles.metricGreen,
          },
          {
            key: 'due_soon' as const,
            label: '24 小时内到期',
            value: assignmentSummaryQuery.data?.due_soon,
            description: '不包含已逾期',
            icon: <ClockCircleOutlined />,
            tone: styles.metricOrange,
          },
          {
            key: 'overdue' as const,
            label: '已逾期',
            value: assignmentSummaryQuery.data?.overdue,
            description: '需要尽快处理',
            icon: <ExclamationCircleOutlined />,
            tone: styles.metricRed,
          },
        ];
  const currentSummaryQuery =
    view === 'managed' ? taskSummaryQuery : assignmentSummaryQuery;
  const currentListQuery = view === 'managed' ? tasksQuery : assignmentsQuery;
  const activeMetric =
    view === 'managed' ? activeManagedMetric : activeAssignmentMetric;
  const currentFilters = view === 'managed' ? taskFilters : assignmentFilters;
  const hasActiveFilters = Object.values(currentFilters).some(
    (value) => value !== undefined && value !== '',
  );

  const openCreateModal = () => {
    taskForm.resetFields();
    taskForm.setFieldsValue({
      is_organization_task: defaultOwnership === 'organization',
      team_id:
        typeof defaultOwnership === 'number' ? defaultOwnership : undefined,
      priority: 'normal',
      assignee_ids: [],
    });
    setCreateOpen(true);
  };

  const resetCurrentFilters = () => {
    if (view === 'managed') {
      resetTaskFilters();
      return;
    }
    resetAssignmentFilters();
  };

  const emptyText = (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      className={styles.emptyState}
      description={
        <Space orientation="vertical" size={2}>
          <Typography.Text strong>
            {hasActiveFilters ? '未找到符合条件的任务' : '暂时没有任务'}
          </Typography.Text>
          <Typography.Text type="secondary">
            {hasActiveFilters
              ? '调整筛选条件，或清除筛选后再试。'
              : view === 'managed'
                ? '新建任务并分配给团队成员后，将在这里统一跟进。'
                : '分配给你的任务会显示在这里。'}
          </Typography.Text>
        </Space>
      }
    >
      {hasActiveFilters ? (
        <Button onClick={resetCurrentFilters}>清除筛选</Button>
      ) : view === 'managed' && canManageTasks ? (
        <Button type="primary" onClick={openCreateModal}>
          新建任务
        </Button>
      ) : null}
    </Empty>
  );

  const submitTask = async (values: TaskFormValues) => {
    await createMutation.mutateAsync({
      team_id: values.is_organization_task ? null : values.team_id,
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
      <div className={styles.pageLayout}>
        <Flex
          align="center"
          className={styles.toolbar}
          gap="middle"
          justify="space-between"
          role="toolbar"
          aria-label="团队任务工具栏"
          wrap
        >
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
        </Flex>

        {currentSummaryQuery.isError ? (
          <Alert
            showIcon
            type="warning"
            title="任务统计暂时无法加载"
            description="任务列表仍可继续使用，请稍后刷新统计数据。"
          />
        ) : null}

        <section className={styles.metricGrid} aria-label="任务统计">
          {summaryMetrics.map((metric) => {
            const isActive = activeMetric === metric.key;

            return (
              <button
                key={metric.key}
                type="button"
                className={`${styles.metricCard} ${metric.tone}`}
                aria-label={`${metric.label} ${metric.value ?? 0}`}
                aria-pressed={isActive}
                onClick={() => {
                  if (view === 'managed') {
                    selectManagedMetric(metric.key);
                    return;
                  }
                  selectAssignmentMetric(metric.key);
                }}
              >
                <div className={styles.metricHeader}>
                  <span className={styles.metricIcon} aria-hidden>
                    {metric.icon}
                  </span>
                </div>
                <Statistic
                  loading={currentSummaryQuery.isLoading}
                  title={metric.label}
                  value={metric.value ?? 0}
                  suffix={<span className={styles.metricUnit}>项</span>}
                />
                <Typography.Text
                  className={styles.metricDescription}
                  title={metric.description}
                  type="secondary"
                >
                  {metric.description}
                </Typography.Text>
                <span className={styles.metricOrnament} aria-hidden />
              </button>
            );
          })}
        </section>

        <Card className={styles.tableCard}>
          <section className={styles.filters} aria-label="任务筛选">
            <div className={styles.filterOptions}>
              <div className={styles.filterField}>
                <Select
                  allowClear
                  className={styles.filterSelect}
                  aria-label="状态筛选"
                  options={
                    view === 'managed'
                      ? taskStatusOptions
                      : assignmentStatusOptions
                  }
                  placeholder="全部状态"
                  value={
                    view === 'managed'
                      ? taskFilters.status
                      : assignmentFilters.status
                  }
                  onChange={(value) => {
                    if (view === 'managed') {
                      applyTaskFilters({ status: value as WorkTaskStatus });
                      return;
                    }
                    applyAssignmentFilters({
                      status: value as TaskAssignmentStatus,
                    });
                  }}
                />
              </div>
              <div className={styles.filterField}>
                <Select
                  allowClear
                  className={styles.filterSelect}
                  aria-label="优先级筛选"
                  options={priorityOptions}
                  placeholder="全部优先级"
                  value={
                    view === 'managed'
                      ? taskFilters.priority
                      : assignmentFilters.priority
                  }
                  onChange={(value) => {
                    if (view === 'managed') {
                      applyTaskFilters({ priority: value as TaskPriority });
                      return;
                    }
                    applyAssignmentFilters({
                      priority: value as TaskPriority,
                    });
                  }}
                />
              </div>
              <div className={styles.filterField}>
                <Select
                  allowClear
                  className={styles.filterSelect}
                  aria-label="团队筛选"
                  loading={teamsQuery.isLoading}
                  options={teamFilterOptions}
                  placeholder="全部团队"
                  showSearch={{ optionFilterProp: 'label' }}
                  value={
                    view === 'managed'
                      ? taskFilters.team_id
                      : assignmentFilters.team_id
                  }
                  onChange={(value) => {
                    if (view === 'managed') {
                      applyTaskFilters({ team_id: value });
                      return;
                    }
                    applyAssignmentFilters({ team_id: value });
                  }}
                />
              </div>
              <div className={styles.filterField}>
                <Select
                  allowClear
                  className={styles.filterSelect}
                  aria-label="截止状态筛选"
                  options={dueStateOptions}
                  placeholder="全部截止"
                  value={
                    view === 'managed'
                      ? taskFilters.due_state
                      : assignmentFilters.due_state
                  }
                  onChange={(value) => {
                    if (view === 'managed') {
                      applyTaskFilters({ due_state: value as TaskDueState });
                      return;
                    }
                    applyAssignmentFilters({
                      due_state: value as TaskDueState,
                    });
                  }}
                />
              </div>
            </div>
            <section className={styles.filterActions} aria-label="任务操作">
              <Input.Search
                allowClear
                className={styles.keywordSearch}
                aria-label="搜索任务"
                placeholder="搜索任务"
                value={
                  view === 'managed' ? taskKeywordInput : assignmentKeywordInput
                }
                onChange={(event) => {
                  const value = event.target.value;
                  if (view === 'managed') {
                    setTaskKeywordInput(value);
                    if (!value) applyTaskFilters({ keyword: undefined });
                    return;
                  }
                  setAssignmentKeywordInput(value);
                  if (!value) applyAssignmentFilters({ keyword: undefined });
                }}
                onSearch={(value) => {
                  const keyword = value.trim() || undefined;
                  if (view === 'managed') {
                    applyTaskFilters({ keyword });
                    return;
                  }
                  applyAssignmentFilters({ keyword });
                }}
              />
              <Button icon={<ReloadOutlined />} onClick={resetCurrentFilters}>
                重置
              </Button>
              {canManageTasks ? (
                <Button
                  className={styles.primaryAction}
                  type="primary"
                  icon={<PlusOutlined />}
                  aria-label="新建任务"
                  onClick={openCreateModal}
                >
                  新建
                </Button>
              ) : null}
            </section>
          </section>

          {currentListQuery.isError ? (
            <Alert
              showIcon
              type="error"
              title="任务列表加载失败"
              description="请检查网络连接后重试。"
              className={styles.listAlert}
              action={
                <Button
                  size="small"
                  onClick={() => void currentListQuery.refetch()}
                >
                  重试
                </Button>
              }
            />
          ) : null}

          {view === 'managed' ? (
            <Table<WorkTask>
              className={styles.table}
              rowKey="id"
              size="middle"
              loading={tasksQuery.isLoading}
              columns={taskColumns}
              dataSource={tasksQuery.data?.items || []}
              locale={{ emptyText }}
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
              className={styles.table}
              rowKey="id"
              size="middle"
              loading={assignmentsQuery.isLoading}
              columns={assignmentColumns}
              dataSource={assignmentsQuery.data?.items || []}
              locale={{ emptyText }}
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
      </div>

      <Modal
        className={styles.createTaskModal}
        width={720}
        centered
        title={
          <div className={styles.createTaskTitle}>
            <div className={styles.createTaskTitleCopy}>
              <Typography.Text strong className={styles.createTaskTitleText}>
                新建任务
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
          <div className={styles.taskSection}>
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
                rows={4}
                placeholder="补充任务背景、完成标准或注意事项"
              />
            </Form.Item>
            <div className={styles.taskFieldsGrid}>
              <Form.Item
                label="优先级"
                name="priority"
                rules={[{ required: true, message: '请选择优先级' }]}
              >
                <Radio.Group
                  className={styles.priorityRadio}
                  options={priorityOptions}
                  optionType="button"
                  buttonStyle="solid"
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
          </div>

          <div className={styles.taskSection}>
            {organizationManage ? (
              <Form.Item
                label="组织级任务"
                name="is_organization_task"
                valuePropName="checked"
                extra="开启后任务面向整个组织，可从组织成员中选择执行人。"
                className={styles.organizationSwitch}
              >
                <Switch
                  onChange={(checked) => {
                    taskForm.setFieldsValue({
                      team_id: checked
                        ? undefined
                        : taskForm.getFieldValue('team_id'),
                      assignee_ids: [],
                    });
                  }}
                />
              </Form.Item>
            ) : null}
            <Form.Item
              label="所属团队"
              name="team_id"
              dependencies={['is_organization_task']}
              rules={[
                ({ getFieldValue }) => ({
                  validator: async (_rule, value) => {
                    if (getFieldValue('is_organization_task') || value) return;
                    throw new Error('请选择所属团队');
                  },
                }),
              ]}
            >
              <Select
                allowClear
                disabled={isOrganizationTask}
                loading={teamsQuery.isLoading || capabilitiesQuery.isLoading}
                options={manageableTeamOptions}
                placeholder="选择所属团队"
                onChange={() => taskForm.setFieldValue('assignee_ids', [])}
              />
            </Form.Item>
            <Form.Item
              label="下发成员"
              name="assignee_ids"
              rules={[{ required: true, message: '请选择至少一名下发成员' }]}
              extra="每位成员都会收到独立任务，可分别接受、拒绝和完成。"
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
          </div>
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
        onClose={closeTaskDetail}
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
        onClose={closeAssignmentDetail}
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="标题">
            {selectedAssignment?.task_title || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="团队">
            {selectedAssignment?.team_name || '组织级任务'}
          </Descriptions.Item>
          <Descriptions.Item label="创建人">
            {personLabel(selectedAssignment?.creator)}
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
