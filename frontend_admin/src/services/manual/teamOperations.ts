import { request } from '@umijs/max';

const BASE_PATH = '/api/team-operations';

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

export type UserSummary = {
  id: number;
  username: string;
  full_name: string;
};

export type AnnouncementStatus = 'draft' | 'published' | 'withdrawn';

export type TeamAnnouncement = {
  id: number;
  organization_id: number;
  team_id?: number | null;
  team_name?: string | null;
  title: string;
  body: string;
  status: AnnouncementStatus;
  status__mapping: string;
  require_acknowledgement: boolean;
  published_by?: UserSummary | null;
  published_at?: string | null;
  expires_at?: string | null;
  is_recipient: boolean;
  is_acknowledged: boolean;
  can_manage: boolean;
  recipient_count: number;
  acknowledged_count: number;
  created_at: string;
  updated_at: string;
};

export type AnnouncementInput = {
  team_id?: number | null;
  title: string;
  body: string;
  require_acknowledgement?: boolean;
  expires_at?: string | null;
};

export type AnnouncementReceipt = {
  announcement_id: number;
  recipient_id: number;
  acknowledged_at?: string | null;
};

export type TaskPriority = 'normal' | 'high' | 'urgent';
export type WorkTaskStatus = 'active' | 'completed' | 'cancelled';
export type TaskAssignmentStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type TaskAssignment = {
  id: number;
  task_id: number;
  task_title: string;
  task_description: string;
  task_type: string;
  priority: TaskPriority;
  priority__mapping: string;
  task_status: WorkTaskStatus;
  task_status__mapping: string;
  team_id?: number | null;
  team_name?: string | null;
  creator?: UserSummary | null;
  assignee: UserSummary;
  status: TaskAssignmentStatus;
  status__mapping: string;
  due_at?: string | null;
  is_overdue: boolean;
  accepted_at?: string | null;
  completed_at?: string | null;
  rejected_at?: string | null;
  result: string;
  created_at: string;
  updated_at: string;
};

export type WorkTask = {
  id: number;
  organization_id: number;
  team_id?: number | null;
  team_name?: string | null;
  title: string;
  description: string;
  task_type: string;
  priority: TaskPriority;
  priority__mapping: string;
  status: WorkTaskStatus;
  status__mapping: string;
  due_at?: string | null;
  creator?: UserSummary | null;
  url: string;
  data: Record<string, unknown>;
  completed_at?: string | null;
  cancelled_at?: string | null;
  can_manage: boolean;
  assignments: TaskAssignment[];
  created_at: string;
  updated_at: string;
};

export type WorkTaskInput = {
  team_id?: number | null;
  title: string;
  description?: string;
  task_type?: string;
  priority?: TaskPriority;
  due_at?: string | null;
  assignee_ids: number[];
  url?: string;
  data?: Record<string, unknown>;
};

export type DailyDashboard = {
  pending_acceptance: number;
  in_progress: number;
  due_today: number;
  overdue: number;
  completed_today: number;
  unacknowledged_announcements: number;
  urgent_items: TaskAssignment[];
};

export type WorkTaskSummary = {
  total: number;
  active: number;
  due_soon: number;
  overdue: number;
};

export type TaskAssignmentSummary = {
  pending: number;
  in_progress: number;
  due_soon: number;
  overdue: number;
};

export type TaskDueState = 'due_soon' | 'overdue';

export type TeamOperationsCapabilities = {
  announcement_organization_manage: boolean;
  announcement_team_ids: number[];
  task_organization_manage: boolean;
  task_team_ids: number[];
};

export type AnnouncementListParams = {
  page?: number;
  page_size?: number;
  team_id?: number;
  status?: AnnouncementStatus;
  keyword?: string;
};

export type TaskListParams = {
  page?: number;
  page_size?: number;
  team_id?: number;
  status?: WorkTaskStatus;
  priority?: TaskPriority;
  keyword?: string;
  due_state?: TaskDueState;
  mine?: boolean;
};

export type AssignmentListParams = {
  page?: number;
  page_size?: number;
  status?: TaskAssignmentStatus;
  team_id?: number;
  priority?: TaskPriority;
  keyword?: string;
  due_state?: TaskDueState;
  overdue?: boolean;
};

export type TaskSummaryParams = {
  team_id?: number;
  priority?: TaskPriority;
  keyword?: string;
};

export type TaskAssigneeListParams = {
  page?: number;
  page_size?: number;
  team_id?: number;
  keyword?: string;
};

export function getTeamOperationsCapabilities() {
  return request<TeamOperationsCapabilities>(`${BASE_PATH}/capabilities/`, {
    method: 'GET',
  });
}

export function listTeamAnnouncements(params: AnnouncementListParams = {}) {
  return request<PageResult<TeamAnnouncement>>(`${BASE_PATH}/announcements/`, {
    method: 'GET',
    params,
  });
}

export function createTeamAnnouncement(payload: AnnouncementInput) {
  return request<TeamAnnouncement>(`${BASE_PATH}/announcements/`, {
    method: 'POST',
    data: payload,
  });
}

export function getTeamAnnouncement(announcementId: number) {
  return request<TeamAnnouncement>(
    `${BASE_PATH}/announcements/${announcementId}/`,
    { method: 'GET' },
  );
}

export function publishTeamAnnouncement(announcementId: number) {
  return request<TeamAnnouncement>(
    `${BASE_PATH}/announcements/${announcementId}/publish/`,
    { method: 'POST' },
  );
}

export function withdrawTeamAnnouncement(announcementId: number) {
  return request<TeamAnnouncement>(
    `${BASE_PATH}/announcements/${announcementId}/withdraw/`,
    { method: 'POST' },
  );
}

export function acknowledgeTeamAnnouncement(announcementId: number) {
  return request<AnnouncementReceipt>(
    `${BASE_PATH}/announcements/${announcementId}/acknowledge/`,
    { method: 'POST' },
  );
}

export function listWorkTasks(params: TaskListParams = {}) {
  return request<PageResult<WorkTask>>(`${BASE_PATH}/tasks/`, {
    method: 'GET',
    params,
  });
}

export function getWorkTaskSummary(params: TaskSummaryParams = {}) {
  return request<WorkTaskSummary>(`${BASE_PATH}/tasks/summary/`, {
    method: 'GET',
    params,
  });
}

export function createWorkTask(payload: WorkTaskInput) {
  return request<WorkTask>(`${BASE_PATH}/tasks/`, {
    method: 'POST',
    data: payload,
  });
}

export function getWorkTask(taskId: number) {
  return request<WorkTask>(`${BASE_PATH}/tasks/${taskId}/`, {
    method: 'GET',
  });
}

export function cancelWorkTask(taskId: number) {
  return request<WorkTask>(`${BASE_PATH}/tasks/${taskId}/cancel/`, {
    method: 'POST',
  });
}

export function listTaskAssignments(params: AssignmentListParams = {}) {
  return request<PageResult<TaskAssignment>>(
    `${BASE_PATH}/task-assignments/`,
    { method: 'GET', params },
  );
}

export function getTaskAssignmentSummary(params: TaskSummaryParams = {}) {
  return request<TaskAssignmentSummary>(
    `${BASE_PATH}/task-assignments/summary/`,
    { method: 'GET', params },
  );
}

export function listTaskAssignees(params: TaskAssigneeListParams = {}) {
  return request<PageResult<UserSummary>>(`${BASE_PATH}/task-assignees/`, {
    method: 'GET',
    params,
  });
}

export function getTaskAssignment(assignmentId: number) {
  return request<TaskAssignment>(
    `${BASE_PATH}/task-assignments/${assignmentId}/`,
    { method: 'GET' },
  );
}

function transitionTaskAssignment(
  assignmentId: number,
  action: 'accept' | 'complete' | 'reject',
  result = '',
) {
  return request<TaskAssignment>(
    `${BASE_PATH}/task-assignments/${assignmentId}/${action}/`,
    { method: 'POST', data: { result } },
  );
}

export function acceptTaskAssignment(assignmentId: number) {
  return transitionTaskAssignment(assignmentId, 'accept');
}

export function completeTaskAssignment(assignmentId: number, result = '') {
  return transitionTaskAssignment(assignmentId, 'complete', result);
}

export function rejectTaskAssignment(assignmentId: number, result = '') {
  return transitionTaskAssignment(assignmentId, 'reject', result);
}

export function getDailyTeamOperationsDashboard() {
  return request<DailyDashboard>(`${BASE_PATH}/dashboard/daily/`, {
    method: 'GET',
  });
}
