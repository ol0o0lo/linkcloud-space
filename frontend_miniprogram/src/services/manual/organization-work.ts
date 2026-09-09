import type {
  AnnouncementIn,
  TaskActionIn,
  TeamOperationsAnnouncementsUsingGetParams,
  TeamOperationsTaskAssigneesUsingGetParams,
  TeamOperationsTaskAssignmentsSummaryUsingGetParams,
  TeamOperationsTaskAssignmentsUsingGetParams,
  TeamOperationsTasksSummaryUsingGetParams,
  TeamOperationsTasksUsingGetParams,
  TeamOut,
  WorkTaskIn,
} from '@/services/openapi/types'
import { buildOrganizationWorkScope } from '@/domain/organization-work'
import { teamsUsingGet } from '@/services/openapi/jichu'
import {
  teamOperationsAnnouncementsAnnouncementIdAcknowledgeUsingPost,
  teamOperationsAnnouncementsAnnouncementIdPublishUsingPost,
  teamOperationsAnnouncementsAnnouncementIdUsingGet,
  teamOperationsAnnouncementsAnnouncementIdWithdrawUsingPost,
  teamOperationsAnnouncementsUsingGet,
  teamOperationsAnnouncementsUsingPost,
  teamOperationsCapabilitiesUsingGet,
  teamOperationsDashboardDailyUsingGet,
  teamOperationsTaskAssigneesUsingGet,
  teamOperationsTaskAssignmentsAssignmentIdAcceptUsingPost,
  teamOperationsTaskAssignmentsAssignmentIdCompleteUsingPost,
  teamOperationsTaskAssignmentsAssignmentIdRejectUsingPost,
  teamOperationsTaskAssignmentsAssignmentIdUsingGet,
  teamOperationsTaskAssignmentsSummaryUsingGet,
  teamOperationsTaskAssignmentsUsingGet,
  teamOperationsTasksSummaryUsingGet,
  teamOperationsTasksTaskIdCancelUsingPost,
  teamOperationsTasksTaskIdUsingGet,
  teamOperationsTasksUsingGet,
  teamOperationsTasksUsingPost,
} from '@/services/openapi/tuanduiyunying'
import { collectAllPages } from '@/shared/pagination/collectAllPages'

export type {
  AnnouncementIn,
  AnnouncementOut,
  AnnouncementReceiptOut,
  DailyDashboardOut,
  PagedAnnouncementOut,
  PagedTaskAssignmentOut,
  PagedUserSummaryOut,
  PagedWorkTaskOut,
  TaskActionIn,
  TaskAssignmentOut,
  TaskAssignmentSummaryOut,
  TeamOperationsCapabilitiesOut,
  TeamOut,
  UserSummaryOut,
  WorkTaskIn,
  WorkTaskOut,
  WorkTaskSummaryOut,
} from '@/services/openapi/types'

export type OrganizationAnnouncementFilters = Omit<TeamOperationsAnnouncementsUsingGetParams, 'page' | 'page_size'>
export type OrganizationTaskAssignmentFilters = Omit<TeamOperationsTaskAssignmentsUsingGetParams, 'page' | 'page_size'>
export type OrganizationWorkTaskFilters = Omit<TeamOperationsTasksUsingGetParams, 'page' | 'page_size'>
export type OrganizationTaskAssigneeFilters = Omit<TeamOperationsTaskAssigneesUsingGetParams, 'page' | 'page_size'>
export type OrganizationAssignmentSummaryFilters = TeamOperationsTaskAssignmentsSummaryUsingGetParams
export type OrganizationTaskSummaryFilters = TeamOperationsTasksSummaryUsingGetParams

export function requestOrganizationWorkCapabilities(organizationSlug: string) {
  return teamOperationsCapabilitiesUsingGet({ options: buildOrganizationWorkScope(organizationSlug) })
}

export async function requestAllOrganizationWorkTeams(organizationSlug: string, pageSize = 100): Promise<TeamOut[]> {
  const teams: TeamOut[] = []
  let page = 1
  while (true) {
    const result = await teamsUsingGet({
      params: { page, page_size: pageSize },
      options: buildOrganizationWorkScope(organizationSlug),
    })
    teams.push(...result.items)
    if (teams.length >= result.total || result.items.length === 0)
      return teams
    page += 1
  }
}

export function requestOrganizationDailyDashboard(organizationSlug: string) {
  return teamOperationsDashboardDailyUsingGet({ options: buildOrganizationWorkScope(organizationSlug) })
}

export function requestOrganizationAnnouncements(organizationSlug: string, page: number, pageSize: number, filters: OrganizationAnnouncementFilters = {}) {
  return teamOperationsAnnouncementsUsingGet({ params: { ...filters, page, page_size: pageSize }, options: buildOrganizationWorkScope(organizationSlug) })
}

export function requestOrganizationAnnouncement(organizationSlug: string, announcementId: number) {
  return teamOperationsAnnouncementsAnnouncementIdUsingGet({ params: { announcement_id: announcementId }, options: buildOrganizationWorkScope(organizationSlug) })
}

export function submitOrganizationAnnouncement(organizationSlug: string, payload: AnnouncementIn) {
  return teamOperationsAnnouncementsUsingPost({ body: payload, options: buildOrganizationWorkScope(organizationSlug, 'never') })
}

export function submitOrganizationAnnouncementAcknowledgement(organizationSlug: string, announcementId: number) {
  return teamOperationsAnnouncementsAnnouncementIdAcknowledgeUsingPost({ params: { announcement_id: announcementId }, options: buildOrganizationWorkScope(organizationSlug, 'never') })
}

export function submitOrganizationAnnouncementPublish(organizationSlug: string, announcementId: number) {
  return teamOperationsAnnouncementsAnnouncementIdPublishUsingPost({ params: { announcement_id: announcementId }, options: buildOrganizationWorkScope(organizationSlug, 'never') })
}

export function submitOrganizationAnnouncementWithdraw(organizationSlug: string, announcementId: number) {
  return teamOperationsAnnouncementsAnnouncementIdWithdrawUsingPost({ params: { announcement_id: announcementId }, options: buildOrganizationWorkScope(organizationSlug, 'never') })
}

export function requestOrganizationTaskAssignments(organizationSlug: string, page: number, pageSize: number, filters: OrganizationTaskAssignmentFilters = {}) {
  return teamOperationsTaskAssignmentsUsingGet({ params: { ...filters, page, page_size: pageSize }, options: buildOrganizationWorkScope(organizationSlug) })
}

export function requestOrganizationTaskAssignmentSummary(organizationSlug: string, filters: OrganizationAssignmentSummaryFilters = {}) {
  return teamOperationsTaskAssignmentsSummaryUsingGet({ params: filters, options: buildOrganizationWorkScope(organizationSlug) })
}

export function requestOrganizationTaskAssignment(organizationSlug: string, assignmentId: number) {
  return teamOperationsTaskAssignmentsAssignmentIdUsingGet({ params: { assignment_id: assignmentId }, options: buildOrganizationWorkScope(organizationSlug) })
}

export function submitOrganizationTaskAssignmentAccept(organizationSlug: string, assignmentId: number, payload: TaskActionIn = {}) {
  return teamOperationsTaskAssignmentsAssignmentIdAcceptUsingPost({ params: { assignment_id: assignmentId }, body: payload, options: buildOrganizationWorkScope(organizationSlug, 'never') })
}

export function submitOrganizationTaskAssignmentComplete(organizationSlug: string, assignmentId: number, payload: TaskActionIn = {}) {
  return teamOperationsTaskAssignmentsAssignmentIdCompleteUsingPost({ params: { assignment_id: assignmentId }, body: payload, options: buildOrganizationWorkScope(organizationSlug, 'never') })
}

export function submitOrganizationTaskAssignmentReject(organizationSlug: string, assignmentId: number, payload: TaskActionIn = {}) {
  return teamOperationsTaskAssignmentsAssignmentIdRejectUsingPost({ params: { assignment_id: assignmentId }, body: payload, options: buildOrganizationWorkScope(organizationSlug, 'never') })
}

export function requestOrganizationWorkTasks(organizationSlug: string, page: number, pageSize: number, filters: OrganizationWorkTaskFilters = {}) {
  return teamOperationsTasksUsingGet({ params: { ...filters, page, page_size: pageSize }, options: buildOrganizationWorkScope(organizationSlug) })
}

export function requestOrganizationWorkTaskSummary(organizationSlug: string, filters: OrganizationTaskSummaryFilters = {}) {
  return teamOperationsTasksSummaryUsingGet({ params: filters, options: buildOrganizationWorkScope(organizationSlug) })
}

export function requestOrganizationWorkTask(organizationSlug: string, taskId: number) {
  return teamOperationsTasksTaskIdUsingGet({ params: { task_id: taskId }, options: buildOrganizationWorkScope(organizationSlug) })
}

export function submitOrganizationWorkTask(organizationSlug: string, payload: WorkTaskIn) {
  return teamOperationsTasksUsingPost({ body: payload, options: buildOrganizationWorkScope(organizationSlug, 'never') })
}

export function submitOrganizationWorkTaskCancellation(organizationSlug: string, taskId: number) {
  return teamOperationsTasksTaskIdCancelUsingPost({ params: { task_id: taskId }, options: buildOrganizationWorkScope(organizationSlug, 'never') })
}

export function requestOrganizationTaskAssignees(organizationSlug: string, page: number, pageSize: number, filters: OrganizationTaskAssigneeFilters = {}) {
  return teamOperationsTaskAssigneesUsingGet({ params: { ...filters, page, page_size: pageSize }, options: buildOrganizationWorkScope(organizationSlug) })
}

export function requestAllOrganizationTaskAssignees(organizationSlug: string, filters: OrganizationTaskAssigneeFilters = {}, pageSize = 100) {
  return collectAllPages(
    ({ page, pageSize: currentPageSize }) => requestOrganizationTaskAssignees(organizationSlug, page, currentPageSize, filters),
    { pageSize, getKey: item => item.id },
  )
}
