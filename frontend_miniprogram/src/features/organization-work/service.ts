import type {
  AnnouncementIn,
  OrganizationAnnouncementFilters,
  OrganizationAssignmentSummaryFilters,
  OrganizationTaskAssigneeFilters,
  OrganizationTaskAssignmentFilters,
  OrganizationTaskSummaryFilters,
  OrganizationWorkTaskFilters,
  TaskActionIn,
  WorkTaskIn,
} from '@/services/manual/organization-work'
import {
  requestAllOrganizationTaskAssignees,
  requestAllOrganizationWorkTeams,
  requestOrganizationAnnouncement,
  requestOrganizationAnnouncements,
  requestOrganizationDailyDashboard,
  requestOrganizationTaskAssignees,
  requestOrganizationTaskAssignment,
  requestOrganizationTaskAssignments,
  requestOrganizationTaskAssignmentSummary,
  requestOrganizationWorkCapabilities,
  requestOrganizationWorkTask,
  requestOrganizationWorkTasks,
  requestOrganizationWorkTaskSummary,
  submitOrganizationAnnouncement,
  submitOrganizationAnnouncementAcknowledgement,
  submitOrganizationAnnouncementPublish,
  submitOrganizationAnnouncementWithdraw,
  submitOrganizationTaskAssignmentAccept,
  submitOrganizationTaskAssignmentComplete,
  submitOrganizationTaskAssignmentReject,
  submitOrganizationWorkTask,
  submitOrganizationWorkTaskCancellation,
} from '@/services/manual/organization-work'

export type {
  AnnouncementIn,
  AnnouncementOut,
  AnnouncementReceiptOut,
  DailyDashboardOut,
  OrganizationAnnouncementFilters,
  OrganizationAssignmentSummaryFilters,
  OrganizationTaskAssigneeFilters,
  OrganizationTaskAssignmentFilters,
  OrganizationTaskSummaryFilters,
  OrganizationWorkTaskFilters,
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
} from '@/services/manual/organization-work'

export function getOrganizationWorkCapabilities(organizationSlug: string) {
  return requestOrganizationWorkCapabilities(organizationSlug)
}

export function listOrganizationWorkTeams(organizationSlug: string) {
  return requestAllOrganizationWorkTeams(organizationSlug)
}

export function getDailyOrganizationWorkDashboard(organizationSlug: string) {
  return requestOrganizationDailyDashboard(organizationSlug)
}

export function listOrganizationAnnouncements(organizationSlug: string, page = 1, pageSize = 20, filters: OrganizationAnnouncementFilters = {}) {
  return requestOrganizationAnnouncements(organizationSlug, page, pageSize, filters)
}

export function getOrganizationAnnouncement(organizationSlug: string, announcementId: number) {
  return requestOrganizationAnnouncement(organizationSlug, announcementId)
}

export function createOrganizationAnnouncement(organizationSlug: string, payload: AnnouncementIn) {
  return submitOrganizationAnnouncement(organizationSlug, payload)
}

export function acknowledgeOrganizationAnnouncement(organizationSlug: string, announcementId: number) {
  return submitOrganizationAnnouncementAcknowledgement(organizationSlug, announcementId)
}

export function publishOrganizationAnnouncement(organizationSlug: string, announcementId: number) {
  return submitOrganizationAnnouncementPublish(organizationSlug, announcementId)
}

export function withdrawOrganizationAnnouncement(organizationSlug: string, announcementId: number) {
  return submitOrganizationAnnouncementWithdraw(organizationSlug, announcementId)
}

export function listOrganizationTaskAssignments(organizationSlug: string, page = 1, pageSize = 20, filters: OrganizationTaskAssignmentFilters = {}) {
  return requestOrganizationTaskAssignments(organizationSlug, page, pageSize, filters)
}

export function getOrganizationTaskAssignmentSummary(organizationSlug: string, filters: OrganizationAssignmentSummaryFilters = {}) {
  return requestOrganizationTaskAssignmentSummary(organizationSlug, filters)
}

export function getOrganizationTaskAssignment(organizationSlug: string, assignmentId: number) {
  return requestOrganizationTaskAssignment(organizationSlug, assignmentId)
}

export function acceptOrganizationTaskAssignment(organizationSlug: string, assignmentId: number, payload: TaskActionIn = {}) {
  return submitOrganizationTaskAssignmentAccept(organizationSlug, assignmentId, payload)
}

export function completeOrganizationTaskAssignment(organizationSlug: string, assignmentId: number, payload: TaskActionIn = {}) {
  return submitOrganizationTaskAssignmentComplete(organizationSlug, assignmentId, payload)
}

export function rejectOrganizationTaskAssignment(organizationSlug: string, assignmentId: number, payload: TaskActionIn = {}) {
  return submitOrganizationTaskAssignmentReject(organizationSlug, assignmentId, payload)
}

export function listOrganizationWorkTasks(organizationSlug: string, page = 1, pageSize = 20, filters: OrganizationWorkTaskFilters = {}) {
  return requestOrganizationWorkTasks(organizationSlug, page, pageSize, filters)
}

export function getOrganizationWorkTaskSummary(organizationSlug: string, filters: OrganizationTaskSummaryFilters = {}) {
  return requestOrganizationWorkTaskSummary(organizationSlug, filters)
}

export function getOrganizationWorkTask(organizationSlug: string, taskId: number) {
  return requestOrganizationWorkTask(organizationSlug, taskId)
}

export function createOrganizationWorkTask(organizationSlug: string, payload: WorkTaskIn) {
  return submitOrganizationWorkTask(organizationSlug, payload)
}

export function cancelOrganizationWorkTask(organizationSlug: string, taskId: number) {
  return submitOrganizationWorkTaskCancellation(organizationSlug, taskId)
}

export function listOrganizationTaskAssignees(organizationSlug: string, page = 1, pageSize = 100, filters: OrganizationTaskAssigneeFilters = {}) {
  return requestOrganizationTaskAssignees(organizationSlug, page, pageSize, filters)
}

export function listAllOrganizationTaskAssignees(organizationSlug: string, filters: OrganizationTaskAssigneeFilters = {}) {
  return requestAllOrganizationTaskAssignees(organizationSlug, filters)
}
