export const organizationQueryKeys = {
  root: (slug?: string) => ['organization-workspace', slug] as const,
  navigation: (slug?: string) =>
    [...organizationQueryKeys.root(slug), 'navigation'] as const,
  members: (
    slug?: string,
    filters?: {
      page?: number;
      keyword?: string;
      teamId?: number;
      ungrouped?: boolean;
    },
  ) => [...organizationQueryKeys.root(slug), 'members', filters] as const,
  member: (slug?: string, memberId?: number) =>
    [...organizationQueryKeys.root(slug), 'member', memberId] as const,
  search: (slug?: string, keyword?: string) =>
    [...organizationQueryKeys.root(slug), 'search', keyword] as const,
  invites: (slug?: string, page?: number) =>
    page === undefined
      ? ([...organizationQueryKeys.root(slug), 'invites'] as const)
      : ([...organizationQueryKeys.root(slug), 'invites', page] as const),
  team: (slug?: string, teamId?: number) =>
    [...organizationQueryKeys.root(slug), 'team', teamId] as const,
  responsibilities: (slug?: string, memberId?: number) =>
    [
      ...organizationQueryKeys.root(slug),
      'responsibilities',
      memberId,
    ] as const,
};
