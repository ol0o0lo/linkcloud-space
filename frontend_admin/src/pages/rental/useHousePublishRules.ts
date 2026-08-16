import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTenantWorkspace } from '@/pages/space/shared';
import { appsSettingsApiListOrgSettings } from '@/services/openapi/organizationSettings';
import { normalizeHousePublishRules } from './publish-rules';

export const HOUSE_PUBLISH_RULES_SETTING_KEY =
  'property_rental.publish_rules';

export function useHousePublishRules() {
  const workspace = useTenantWorkspace();
  const settings = useQuery({
    queryKey: [
      'settings',
      'organization',
      workspace.selectedOrgSlug,
      HOUSE_PUBLISH_RULES_SETTING_KEY,
    ],
    queryFn: () => appsSettingsApiListOrgSettings(),
    enabled: Boolean(workspace.selectedOrgSlug),
    staleTime: 60_000,
  });
  const rules = useMemo(
    () =>
      normalizeHousePublishRules(
        settings.data?.find(
          (item) => item.key === HOUSE_PUBLISH_RULES_SETTING_KEY,
        )?.value,
      ),
    [settings.data],
  );

  return { ...settings, rules };
}
