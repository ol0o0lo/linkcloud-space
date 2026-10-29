import assert from 'node:assert/strict'
import test from 'node:test'
import { buildOrganizationViewingCreatePayload } from '../src/pages-org-rental/domain/organization-rental.ts'

test('从咨询安排带看保留联系人和咨询上下文，使转派后的业务可继续', () => {
  const result = buildOrganizationViewingCreatePayload({
    house_id: 12,
    contact_id: 34,
    source_inquiry_id: 56,
    customer_name: ' 租客 ',
    customer_phone: ' 13800138000 ',
    scheduled_at: Date.UTC(2026, 11, 1),
    assigned_to_id: 78,
    notes: '',
  })
  assert.equal(result.contact_id, 34)
  assert.equal(result.source_inquiry_id, 56)
  assert.equal(result.assigned_to_id, 78)
})
