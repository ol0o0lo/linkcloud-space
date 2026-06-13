import { request } from '@umijs/max';

type OrganizationSwitchListItemResponse = {
  id: number;
  name: string;
  slug: string;
  is_current: boolean;
  is_primary: boolean;
};

function mapOrganizationOption(item: OrganizationSwitchListItemResponse): API.OrganizationOption {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    isCurrent: item.is_current,
    isPrimary: item.is_primary,
  };
}

export async function getOrganizationSwitchList(options?: { [key: string]: any }) {
  const items = await request<OrganizationSwitchListItemResponse[]>('/api/organizations/switch-list/', {
    method: 'GET',
    ...(options || {}),
  });

  return items.map(mapOrganizationOption);
}
