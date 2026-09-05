import { request } from '@umijs/max';

export type OrganizationMemberEmployeeProfile = {
  employee_name: string;
  job_title: string;
};

type MemberWithEmployeeProfile = (API.MemberOut | API.WorkspaceMemberOut) &
  Partial<OrganizationMemberEmployeeProfile>;

export function getWorkspaceMemberEmployeeName(
  member: API.MemberOut | API.WorkspaceMemberOut,
) {
  return (member as MemberWithEmployeeProfile).employee_name || '';
}

export function getWorkspaceMemberJobTitle(
  member: API.MemberOut | API.WorkspaceMemberOut,
) {
  return (member as MemberWithEmployeeProfile).job_title || '';
}

export async function patchOrganizationMemberEmployeeProfile(
  memberId: number,
  body: OrganizationMemberEmployeeProfile,
) {
  return request<API.MemberOut & OrganizationMemberEmployeeProfile>(
    `/api/organization-members/${memberId}/`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      data: body,
    },
  );
}
