import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getWorkspaceMemberEmployeeName,
  getWorkspaceMemberJobTitle,
  patchOrganizationMemberEmployeeProfile,
} from './organizationMembers';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@umijs/max', () => ({ request }));

describe('organizationMembers manual service', () => {
  beforeEach(() => {
    request.mockReset();
  });

  it('读取组织成员扩展的员工姓名和职位', () => {
    const member = {
      employee_name: '吴晨',
      job_title: '招商主管',
    } as unknown as API.WorkspaceMemberOut;

    expect(getWorkspaceMemberEmployeeName(member)).toBe('吴晨');
    expect(getWorkspaceMemberJobTitle(member)).toBe('招商主管');
  });

  it('通过成员更新接口保存组织内员工资料', async () => {
    request.mockResolvedValue({ employee_name: '吴晨', job_title: '招商主管' });

    await patchOrganizationMemberEmployeeProfile(8, {
      employee_name: '吴晨',
      job_title: '招商主管',
    });

    expect(request).toHaveBeenCalledWith('/api/organization-members/8/', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      data: { employee_name: '吴晨', job_title: '招商主管' },
    });
  });
});
