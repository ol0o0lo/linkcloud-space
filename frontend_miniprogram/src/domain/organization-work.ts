export type OrganizationWorkStatusTone = 'default' | 'primary' | 'success' | 'warning' | 'danger'
export type OrganizationTaskScope = 'mine' | 'team'
export type OrganizationAssignmentAction = 'accept' | 'complete' | 'reject'
export type OrganizationTaskAction = 'cancel'
export type OrganizationAnnouncementAction = 'acknowledge' | 'publish' | 'withdraw'
export type OrganizationWorkManageScope = 'organization' | `team:${number}`

export interface OrganizationWorkManageScopeOption {
  label: string
  value: OrganizationWorkManageScope
  teamId: number | undefined
}

export interface OrganizationWorkManageScopeInput {
  organizationManage: boolean
  teamIds?: number[]
  teams?: OrganizationWorkTeamInput[]
}

export interface OrganizationWorkTeamInput {
  id: number
  name: string
}

export interface OrganizationWorkDueAtInput {
  day: number
  hour: number
  minute: number
  month: number
  year: number
}

interface OrganizationTaskActionInput {
  can_manage?: boolean
  status: string
}

interface OrganizationAnnouncementActionInput {
  can_manage?: boolean
  expires_at?: string | null
  is_acknowledged?: boolean
  is_recipient?: boolean
  require_acknowledgement: boolean
  status: string
}

interface OrganizationWorkUserInput {
  full_name?: string | null
  username?: string | null
}

const assignmentStatusTones: Record<string, OrganizationWorkStatusTone> = {
  pending: 'warning',
  in_progress: 'primary',
  completed: 'success',
  rejected: 'danger',
  cancelled: 'default',
}

const taskStatusTones: Record<string, OrganizationWorkStatusTone> = {
  active: 'primary',
  completed: 'success',
  cancelled: 'default',
}

const announcementStatusTones: Record<string, OrganizationWorkStatusTone> = {
  draft: 'default',
  published: 'primary',
  withdrawn: 'warning',
}

const priorityTones: Record<string, OrganizationWorkStatusTone> = {
  normal: 'default',
  high: 'warning',
  urgent: 'danger',
}

export function buildOrganizationWorkScope(organizationSlug: string, authRetry: 'safe' | 'never' = 'safe') {
  const normalizedSlug = organizationSlug.trim()
  if (!normalizedSlug)
    throw new Error('未选择组织，请先切换到中介端')
  return {
    requestScope: { kind: 'organization' as const, organizationSlug: normalizedSlug },
    authRetry,
  }
}

export function buildTaskScopeOptions(canManage: boolean): Array<{ label: string, value: OrganizationTaskScope }> {
  const options: Array<{ label: string, value: OrganizationTaskScope }> = [{ label: '我的任务', value: 'mine' }]
  if (canManage)
    options.push({ label: '团队任务', value: 'team' })
  return options
}

export function buildOrganizationWorkManageScopeOptions(input: OrganizationWorkManageScopeInput): OrganizationWorkManageScopeOption[] {
  const options: OrganizationWorkManageScopeOption[] = []
  if (input.organizationManage)
    options.push({ label: '全组织', value: 'organization', teamId: undefined })
  const teamNames = new Map<number, string>()
  for (const team of input.teams || []) {
    if (!teamNames.has(team.id))
      teamNames.set(team.id, team.name.trim())
  }
  const teamIds = input.organizationManage ? input.teams?.map(team => team.id) : input.teamIds
  for (const teamId of Array.from(new Set(teamIds || [])))
    options.push({ label: teamNames.get(teamId) || `团队编号 ${teamId}`, value: `team:${teamId}`, teamId })
  return options
}

export function buildOrganizationWorkDueAtIso(input: OrganizationWorkDueAtInput): string {
  const values = [input.year, input.month, input.day, input.hour, input.minute]
  if (!values.every(Number.isInteger))
    throw new Error('截止时间无效')
  const date = new Date(input.year, input.month - 1, input.day, input.hour, input.minute)
  if (
    date.getFullYear() !== input.year
    || date.getMonth() !== input.month - 1
    || date.getDate() !== input.day
    || date.getHours() !== input.hour
    || date.getMinutes() !== input.minute
  ) {
    throw new Error('截止时间无效')
  }
  return date.toISOString()
}

export function getAssignmentActions(status: string): OrganizationAssignmentAction[] {
  if (status === 'pending')
    return ['accept', 'reject']
  if (status === 'in_progress')
    return ['complete']
  return []
}

export function getTaskActions(task: OrganizationTaskActionInput): OrganizationTaskAction[] {
  return task.can_manage === true && task.status === 'active' ? ['cancel'] : []
}

export function isOrganizationAnnouncementExpired(expiresAt?: string | null, now: Date | string | number = new Date()): boolean {
  if (!expiresAt)
    return false
  const expiresAtTimestamp = new Date(expiresAt).getTime()
  const nowTimestamp = new Date(now).getTime()
  return Number.isFinite(expiresAtTimestamp) && Number.isFinite(nowTimestamp) && expiresAtTimestamp <= nowTimestamp
}

export function shouldShowAnnouncementAcknowledgement(announcement: Pick<OrganizationAnnouncementActionInput, 'expires_at' | 'is_recipient' | 'require_acknowledgement' | 'status'>, now: Date | string | number = new Date()): boolean {
  return announcement.status === 'published'
    && announcement.require_acknowledgement
    && announcement.is_recipient === true
    && !isOrganizationAnnouncementExpired(announcement.expires_at, now)
}

export function getAnnouncementActions(announcement: OrganizationAnnouncementActionInput, now: Date | string | number = new Date()): OrganizationAnnouncementAction[] {
  const actions: OrganizationAnnouncementAction[] = []
  if (shouldShowAnnouncementAcknowledgement(announcement, now) && announcement.is_acknowledged !== true)
    actions.push('acknowledge')
  if (announcement.can_manage === true && announcement.status === 'draft')
    actions.push('publish')
  if (announcement.can_manage === true && announcement.status === 'published')
    actions.push('withdraw')
  return actions
}

export function getAssignmentStatusTone(status: string): OrganizationWorkStatusTone {
  return assignmentStatusTones[status] || 'default'
}

export function getTaskStatusTone(status: string): OrganizationWorkStatusTone {
  return taskStatusTones[status] || 'default'
}

export function getAnnouncementStatusTone(status: string): OrganizationWorkStatusTone {
  return announcementStatusTones[status] || 'default'
}

export function getPriorityTone(priority: string): OrganizationWorkStatusTone {
  return priorityTones[priority] || 'default'
}

export function formatOrganizationWorkDateTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '--'
}

export function formatOrganizationWorkUser(user?: OrganizationWorkUserInput | null): string {
  return user?.full_name?.trim() || user?.username?.trim() || '--'
}
