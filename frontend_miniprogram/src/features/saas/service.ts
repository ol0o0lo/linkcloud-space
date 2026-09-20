import { runtimeHttpClient } from '@/infra/http/runtime'

export interface SaaSPlanPrice {
  billing_cycle: 'month' | 'year'
  amount: number
  version: number
  display_note: string
}

export interface SaaSPlanEntitlement {
  version: number
  member_limit: number | null
  team_limit: number | null
  house_limit: number | null
  feature_flags: Record<string, boolean>
}

export interface SaaSPlan {
  code: string
  name: string
  description: string
  purchase_mode: 'self_service' | 'sales_assisted'
  display_order: number
  is_active: boolean
  prices: SaaSPlanPrice[]
  entitlement: SaaSPlanEntitlement | null
}

export interface CreateSaaSWorkspaceInput {
  name: string
  business_type: 'individual' | 'store'
  city_code?: string
  city_name: string
  team_size_band: '1' | '2_10' | '11_50' | '51_plus'
  source: string
}

export interface CreateSaaSWorkspaceResult {
  id: number
  name: string
  slug: string
  trial: null | {
    granted: boolean
    plan_code: string
    plan_name: string
    ends_at: string
  }
}

export interface SaaSOnboardingTask {
  key: 'house_created' | 'collaboration_started' | 'business_completed'
  title: string
  description: string
  completed: boolean
  completed_at: string | null
  deadline_at: string | null
  action: 'create_house' | 'invite_member' | 'assign_responsibility' | 'create_viewing'
}

export interface SaaSOnboardingProgress {
  completed_count: number
  total_count: number
  completion_percent: number
  activated: boolean
  trial_ends_at: string | null
  trial_days_remaining: number | null
  tasks: SaaSOnboardingTask[]
}

export interface SalesLeadInput {
  contact_name: string
  contact_phone: string
  company_name: string
  city_name: string
  team_size: string
  house_scale: string
  needs: string
  source: string
}

export interface SalesLeadResult extends SalesLeadInput {
  id: number
  status: string
  created_at: string
}

export interface SubscriptionOrderResult {
  order_no: string
  status: string
  target_plan_name: string
  paid_at: string | null
}

export function listPublicSaaSPlans() {
  return runtimeHttpClient.request<SaaSPlan[]>({
    url: '/api/public/saas/plans/',
    scope: { kind: 'public' },
  })
}

export function createSaaSWorkspace(payload: CreateSaaSWorkspaceInput) {
  return runtimeHttpClient.request<CreateSaaSWorkspaceResult, CreateSaaSWorkspaceInput>({
    url: '/api/organizations/',
    method: 'POST',
    authRetry: 'never',
    scope: { kind: 'personal' },
    body: payload,
  })
}

export function getSaaSOnboardingProgress(organizationSlug: string) {
  return runtimeHttpClient.request<SaaSOnboardingProgress>({
    url: '/api/subscriptions/onboarding-progress/',
    scope: { kind: 'organization', organizationSlug },
  })
}

export function createSalesLead(payload: SalesLeadInput, organizationSlug = '') {
  return runtimeHttpClient.request<SalesLeadResult, SalesLeadInput>({
    url: organizationSlug ? '/api/subscriptions/sales-leads/' : '/api/public/saas/sales-leads/',
    method: 'POST',
    authRetry: 'never',
    scope: organizationSlug ? { kind: 'organization', organizationSlug } : { kind: 'public' },
    body: payload,
  })
}

export function refreshSaaSOrderPayment(organizationSlug: string, orderNo: string) {
  return runtimeHttpClient.request<SubscriptionOrderResult>({
    url: `/api/subscriptions/orders/${encodeURIComponent(orderNo)}/refresh-payment/`,
    method: 'POST',
    authRetry: 'never',
    scope: { kind: 'organization', organizationSlug },
  })
}
