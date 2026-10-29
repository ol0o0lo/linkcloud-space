import { buildOrganizationScope } from '@/domain/organization-scope'
import { allocationBeneficiariesUsingGet } from '@/services/openapi/shouyifenpei'
import { collectAllPages } from '@/utils/pagination/collectAllPages'

export type { AllocationBeneficiaryOut } from '@/services/openapi/types'

export function listSigningBeneficiaries(organizationSlug: string) {
  return collectAllPages(
    ({ page, pageSize }) => allocationBeneficiariesUsingGet({ params: { page, page_size: pageSize }, options: buildOrganizationScope(organizationSlug) }),
    { pageSize: 100, getKey: item => item.user_id },
  )
}
