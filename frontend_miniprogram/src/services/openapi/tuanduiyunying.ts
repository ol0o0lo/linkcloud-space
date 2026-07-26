/* eslint-disable */
// @ts-ignore
import request from '@/http/vue-query';
import { CustomRequestOptions_ } from '@/http/types';

import * as API from './types';

/** 获取团队公告列表 GET /api/team-operations/announcements/ */
export function teamOperationsAnnouncementsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.TeamOperationsAnnouncementsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedAnnouncementOut>(
    '/api/team-operations/announcements/',
    {
      method: 'GET',
      params: {
        // page has a default value: 1
        page: '1',
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 创建团队公告 POST /api/team-operations/announcements/ */
export function teamOperationsAnnouncementsUsingPost({
  body,
  options,
}: {
  body: API.AnnouncementIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.AnnouncementOut>('/api/team-operations/announcements/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取团队公告详情 GET /api/team-operations/announcements/${param0}/ */
export function teamOperationsAnnouncementsAnnouncementIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.TeamOperationsAnnouncementsAnnouncementIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { announcement_id: param0, ...queryParams } = params;

  return request<API.AnnouncementOut>(
    `/api/team-operations/announcements/${param0}/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 确认团队公告 POST /api/team-operations/announcements/${param0}/acknowledge/ */
export function teamOperationsAnnouncementsAnnouncementIdAcknowledgeUsingPost({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.TeamOperationsAnnouncementsAnnouncementIdAcknowledgeUsingPostParams;
  options?: CustomRequestOptions_;
}) {
  const { announcement_id: param0, ...queryParams } = params;

  return request<API.AnnouncementReceiptOut>(
    `/api/team-operations/announcements/${param0}/acknowledge/`,
    {
      method: 'POST',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 发布团队公告 POST /api/team-operations/announcements/${param0}/publish/ */
export function teamOperationsAnnouncementsAnnouncementIdPublishUsingPost({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.TeamOperationsAnnouncementsAnnouncementIdPublishUsingPostParams;
  options?: CustomRequestOptions_;
}) {
  const { announcement_id: param0, ...queryParams } = params;

  return request<API.AnnouncementOut>(
    `/api/team-operations/announcements/${param0}/publish/`,
    {
      method: 'POST',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 撤回团队公告 POST /api/team-operations/announcements/${param0}/withdraw/ */
export function teamOperationsAnnouncementsAnnouncementIdWithdrawUsingPost({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.TeamOperationsAnnouncementsAnnouncementIdWithdrawUsingPostParams;
  options?: CustomRequestOptions_;
}) {
  const { announcement_id: param0, ...queryParams } = params;

  return request<API.AnnouncementOut>(
    `/api/team-operations/announcements/${param0}/withdraw/`,
    {
      method: 'POST',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 获取团队运营权限范围 GET /api/team-operations/capabilities/ */
export function teamOperationsCapabilitiesUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.TeamOperationsCapabilitiesOut>(
    '/api/team-operations/capabilities/',
    {
      method: 'GET',
      ...(options || {}),
    }
  );
}

/** 获取个人日常任务看板 GET /api/team-operations/dashboard/daily/ */
export function teamOperationsDashboardDailyUsingGet({
  options,
}: {
  options?: CustomRequestOptions_;
}) {
  return request<API.DailyDashboardOut>(
    '/api/team-operations/dashboard/daily/',
    {
      method: 'GET',
      ...(options || {}),
    }
  );
}

/** 获取可分配任务的成员 GET /api/team-operations/task-assignees/ */
export function teamOperationsTaskAssigneesUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.TeamOperationsTaskAssigneesUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedUserSummaryOut>(
    '/api/team-operations/task-assignees/',
    {
      method: 'GET',
      params: {
        // page has a default value: 1
        page: '1',
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 获取我的任务分配列表 GET /api/team-operations/task-assignments/ */
export function teamOperationsTaskAssignmentsUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.TeamOperationsTaskAssignmentsUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedTaskAssignmentOut>(
    '/api/team-operations/task-assignments/',
    {
      method: 'GET',
      params: {
        // page has a default value: 1
        page: '1',
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 获取我的任务分配详情 GET /api/team-operations/task-assignments/${param0}/ */
export function teamOperationsTaskAssignmentsAssignmentIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.TeamOperationsTaskAssignmentsAssignmentIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { assignment_id: param0, ...queryParams } = params;

  return request<API.TaskAssignmentOut>(
    `/api/team-operations/task-assignments/${param0}/`,
    {
      method: 'GET',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 接受任务 POST /api/team-operations/task-assignments/${param0}/accept/ */
export function teamOperationsTaskAssignmentsAssignmentIdAcceptUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.TeamOperationsTaskAssignmentsAssignmentIdAcceptUsingPostParams;
  body: API.TaskActionIn;
  options?: CustomRequestOptions_;
}) {
  const { assignment_id: param0, ...queryParams } = params;

  return request<API.TaskAssignmentOut>(
    `/api/team-operations/task-assignments/${param0}/accept/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 完成任务 POST /api/team-operations/task-assignments/${param0}/complete/ */
export function teamOperationsTaskAssignmentsAssignmentIdCompleteUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.TeamOperationsTaskAssignmentsAssignmentIdCompleteUsingPostParams;
  body: API.TaskActionIn;
  options?: CustomRequestOptions_;
}) {
  const { assignment_id: param0, ...queryParams } = params;

  return request<API.TaskAssignmentOut>(
    `/api/team-operations/task-assignments/${param0}/complete/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 拒绝任务 POST /api/team-operations/task-assignments/${param0}/reject/ */
export function teamOperationsTaskAssignmentsAssignmentIdRejectUsingPost({
  params,
  body,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.TeamOperationsTaskAssignmentsAssignmentIdRejectUsingPostParams;
  body: API.TaskActionIn;
  options?: CustomRequestOptions_;
}) {
  const { assignment_id: param0, ...queryParams } = params;

  return request<API.TaskAssignmentOut>(
    `/api/team-operations/task-assignments/${param0}/reject/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 获取团队任务列表 GET /api/team-operations/tasks/ */
export function teamOperationsTasksUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.TeamOperationsTasksUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  return request<API.PagedWorkTaskOut>('/api/team-operations/tasks/', {
    method: 'GET',
    params: {
      // page has a default value: 1
      page: '1',
      ...params,
    },
    ...(options || {}),
  });
}

/** 创建团队任务 POST /api/team-operations/tasks/ */
export function teamOperationsTasksUsingPost({
  body,
  options,
}: {
  body: API.WorkTaskIn;
  options?: CustomRequestOptions_;
}) {
  return request<API.WorkTaskOut>('/api/team-operations/tasks/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取团队任务详情 GET /api/team-operations/tasks/${param0}/ */
export function teamOperationsTasksTaskIdUsingGet({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.TeamOperationsTasksTaskIdUsingGetParams;
  options?: CustomRequestOptions_;
}) {
  const { task_id: param0, ...queryParams } = params;

  return request<API.WorkTaskOut>(`/api/team-operations/tasks/${param0}/`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 取消团队任务 POST /api/team-operations/tasks/${param0}/cancel/ */
export function teamOperationsTasksTaskIdCancelUsingPost({
  params,
  options,
}: {
  // 叠加生成的Param类型 (非body参数openapi默认没有生成对象)
  params: API.TeamOperationsTasksTaskIdCancelUsingPostParams;
  options?: CustomRequestOptions_;
}) {
  const { task_id: param0, ...queryParams } = params;

  return request<API.WorkTaskOut>(
    `/api/team-operations/tasks/${param0}/cancel/`,
    {
      method: 'POST',
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}
