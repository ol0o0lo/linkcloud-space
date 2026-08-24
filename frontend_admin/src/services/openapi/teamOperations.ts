// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 获取团队公告列表 GET /api/team-operations/announcements/ */
export async function appsTeamOperationsApiListAnnouncements(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsTeamOperationsApiListAnnouncementsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedAnnouncementOut>(
    "/api/team-operations/announcements/",
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 创建团队公告 POST /api/team-operations/announcements/ */
export async function appsTeamOperationsApiCreateAnnouncement(
  body: API.AnnouncementIn,
  options?: { [key: string]: any }
) {
  return request<API.AnnouncementOut>("/api/team-operations/announcements/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取团队公告详情 GET /api/team-operations/announcements/${param0}/ */
export async function appsTeamOperationsApiGetAnnouncement(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsTeamOperationsApiGetAnnouncementParams,
  options?: { [key: string]: any }
) {
  const { announcement_id: param0, ...queryParams } = params;
  return request<API.AnnouncementOut>(
    `/api/team-operations/announcements/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 确认团队公告 POST /api/team-operations/announcements/${param0}/acknowledge/ */
export async function appsTeamOperationsApiAcknowledgeAnnouncementEndpoint(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsTeamOperationsApiAcknowledgeAnnouncementEndpointParams,
  options?: { [key: string]: any }
) {
  const { announcement_id: param0, ...queryParams } = params;
  return request<API.AnnouncementReceiptOut>(
    `/api/team-operations/announcements/${param0}/acknowledge/`,
    {
      method: "POST",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 发布团队公告 POST /api/team-operations/announcements/${param0}/publish/ */
export async function appsTeamOperationsApiPublishAnnouncementEndpoint(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsTeamOperationsApiPublishAnnouncementEndpointParams,
  options?: { [key: string]: any }
) {
  const { announcement_id: param0, ...queryParams } = params;
  return request<API.AnnouncementOut>(
    `/api/team-operations/announcements/${param0}/publish/`,
    {
      method: "POST",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 撤回团队公告 POST /api/team-operations/announcements/${param0}/withdraw/ */
export async function appsTeamOperationsApiWithdrawAnnouncementEndpoint(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsTeamOperationsApiWithdrawAnnouncementEndpointParams,
  options?: { [key: string]: any }
) {
  const { announcement_id: param0, ...queryParams } = params;
  return request<API.AnnouncementOut>(
    `/api/team-operations/announcements/${param0}/withdraw/`,
    {
      method: "POST",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取团队运营权限范围 GET /api/team-operations/capabilities/ */
export async function appsTeamOperationsApiGetCapabilities(options?: {
  [key: string]: any;
}) {
  return request<API.TeamOperationsCapabilitiesOut>(
    "/api/team-operations/capabilities/",
    {
      method: "GET",
      ...(options || {}),
    }
  );
}

/** 获取个人日常任务看板 GET /api/team-operations/dashboard/daily/ */
export async function appsTeamOperationsApiGetDailyDashboard(options?: {
  [key: string]: any;
}) {
  return request<API.DailyDashboardOut>(
    "/api/team-operations/dashboard/daily/",
    {
      method: "GET",
      ...(options || {}),
    }
  );
}

/** 获取可分配任务的成员 GET /api/team-operations/task-assignees/ */
export async function appsTeamOperationsApiListTaskAssignees(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsTeamOperationsApiListTaskAssigneesParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedUserSummaryOut>(
    "/api/team-operations/task-assignees/",
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 获取我的任务分配列表 GET /api/team-operations/task-assignments/ */
export async function appsTeamOperationsApiListTaskAssignments(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsTeamOperationsApiListTaskAssignmentsParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedTaskAssignmentOut>(
    "/api/team-operations/task-assignments/",
    {
      method: "GET",
      params: {
        // page has a default value: 1
        page: "1",
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 获取我的任务分配详情 GET /api/team-operations/task-assignments/${param0}/ */
export async function appsTeamOperationsApiGetTaskAssignment(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsTeamOperationsApiGetTaskAssignmentParams,
  options?: { [key: string]: any }
) {
  const { assignment_id: param0, ...queryParams } = params;
  return request<API.TaskAssignmentOut>(
    `/api/team-operations/task-assignments/${param0}/`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 接受任务 POST /api/team-operations/task-assignments/${param0}/accept/ */
export async function appsTeamOperationsApiAcceptTaskAssignment(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsTeamOperationsApiAcceptTaskAssignmentParams,
  body: API.TaskActionIn,
  options?: { [key: string]: any }
) {
  const { assignment_id: param0, ...queryParams } = params;
  return request<API.TaskAssignmentOut>(
    `/api/team-operations/task-assignments/${param0}/accept/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 完成任务 POST /api/team-operations/task-assignments/${param0}/complete/ */
export async function appsTeamOperationsApiCompleteTaskAssignment(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsTeamOperationsApiCompleteTaskAssignmentParams,
  body: API.TaskActionIn,
  options?: { [key: string]: any }
) {
  const { assignment_id: param0, ...queryParams } = params;
  return request<API.TaskAssignmentOut>(
    `/api/team-operations/task-assignments/${param0}/complete/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 拒绝任务 POST /api/team-operations/task-assignments/${param0}/reject/ */
export async function appsTeamOperationsApiRejectTaskAssignment(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsTeamOperationsApiRejectTaskAssignmentParams,
  body: API.TaskActionIn,
  options?: { [key: string]: any }
) {
  const { assignment_id: param0, ...queryParams } = params;
  return request<API.TaskAssignmentOut>(
    `/api/team-operations/task-assignments/${param0}/reject/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取我的任务统计 GET /api/team-operations/task-assignments/summary/ */
export async function appsTeamOperationsApiGetTaskAssignmentSummary(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsTeamOperationsApiGetTaskAssignmentSummaryParams,
  options?: { [key: string]: any }
) {
  return request<API.TaskAssignmentSummaryOut>(
    "/api/team-operations/task-assignments/summary/",
    {
      method: "GET",
      params: {
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 获取团队任务列表 GET /api/team-operations/tasks/ */
export async function appsTeamOperationsApiListTasks(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsTeamOperationsApiListTasksParams,
  options?: { [key: string]: any }
) {
  return request<API.PagedWorkTaskOut>("/api/team-operations/tasks/", {
    method: "GET",
    params: {
      // page has a default value: 1
      page: "1",
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建团队任务 POST /api/team-operations/tasks/ */
export async function appsTeamOperationsApiCreateTask(
  body: API.WorkTaskIn,
  options?: { [key: string]: any }
) {
  return request<API.WorkTaskOut>("/api/team-operations/tasks/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取团队任务详情 GET /api/team-operations/tasks/${param0}/ */
export async function appsTeamOperationsApiGetTask(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsTeamOperationsApiGetTaskParams,
  options?: { [key: string]: any }
) {
  const { task_id: param0, ...queryParams } = params;
  return request<API.WorkTaskOut>(`/api/team-operations/tasks/${param0}/`, {
    method: "GET",
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 取消团队任务 POST /api/team-operations/tasks/${param0}/cancel/ */
export async function appsTeamOperationsApiCancelTask(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsTeamOperationsApiCancelTaskParams,
  options?: { [key: string]: any }
) {
  const { task_id: param0, ...queryParams } = params;
  return request<API.WorkTaskOut>(
    `/api/team-operations/tasks/${param0}/cancel/`,
    {
      method: "POST",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取团队任务统计 GET /api/team-operations/tasks/summary/ */
export async function appsTeamOperationsApiGetTaskSummary(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.appsTeamOperationsApiGetTaskSummaryParams,
  options?: { [key: string]: any }
) {
  return request<API.WorkTaskSummaryOut>(
    "/api/team-operations/tasks/summary/",
    {
      method: "GET",
      params: {
        ...params,
      },
      ...(options || {}),
    }
  );
}
