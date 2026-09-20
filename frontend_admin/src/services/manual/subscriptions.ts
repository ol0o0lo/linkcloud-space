import { request } from '@umijs/max';

export type SubscriptionSalesLeadStatus =
  | 'new'
  | 'contacting'
  | 'qualified'
  | 'won'
  | 'lost';

export type SubscriptionSalesLead = {
  id: number;
  user_id: number | null;
  organization_id: number | null;
  organization_name: string;
  contact_name: string;
  contact_phone: string;
  company_name: string;
  city_name: string;
  team_size: string;
  house_scale: string;
  needs: string;
  source: string;
  status: SubscriptionSalesLeadStatus;
  admin_note: string;
  assigned_to_id: number | null;
  assigned_to_name: string;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionSalesLeadPage = {
  items: SubscriptionSalesLead[];
  total: number;
  page: number;
  page_size: number;
};

export function cancelSubscriptionOrder(orderNo: string) {
  return request<API.SaaSOrderOut>(
    `/api/subscriptions/orders/${encodeURIComponent(orderNo)}/cancel/`,
    { method: 'POST' },
  );
}

export function listSubscriptionSalesLeads(params: {
  page: number;
  page_size: number;
  keyword?: string;
  status?: SubscriptionSalesLeadStatus;
}) {
  return request<SubscriptionSalesLeadPage>('/api/admin/subscriptions/sales-leads/', {
    method: 'GET',
    params,
  });
}

export function updateSubscriptionSalesLead(
  leadId: number,
  payload: {
    status: SubscriptionSalesLeadStatus;
    admin_note: string;
  },
) {
  return request<SubscriptionSalesLead>(
    `/api/admin/subscriptions/sales-leads/${leadId}/`,
    { method: 'PATCH', data: payload },
  );
}
