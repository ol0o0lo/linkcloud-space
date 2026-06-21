import { useQuery } from '@tanstack/react-query';
import { Card, Table, Tag } from 'antd';
import React from 'react';
import { adminTableScroll } from '@/pages/_shared/adminLayout';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi, type ContactOut } from '@/services/manual/house';
import { CONTACT_ROLE_OPTIONS } from '../constants';

const ROLE_TEXT = Object.fromEntries(CONTACT_ROLE_OPTIONS.map((item) => [item.value, item.label]));

const ContactsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const enabled = Boolean(workspace.selectedOrgSlug);
  const contacts = useQuery({ queryKey: ['house', 'contacts', workspace.selectedOrgSlug], queryFn: () => houseApi.listContacts({ page: 1, page_size: 100 }), enabled });

  return (
    <TenantSelectionGuard title="联系人" subtitle="沉淀房东、租客和客户资料。">
      <Card title="联系人列表">
        <Table<ContactOut>
          rowKey="id"
          loading={contacts.isLoading}
          columns={[
            { title: '姓名', dataIndex: 'name' },
            { title: '手机', dataIndex: 'phone' },
            { title: '邮箱', dataIndex: 'email' },
            { title: '角色', dataIndex: 'roles', render: (roles = []) => roles.map((role: string) => <Tag key={role}>{ROLE_TEXT[role] || role}</Tag>) },
            { title: '备注', dataIndex: 'notes' },
          ]}
          dataSource={contacts.data?.items || []}
          pagination={false}
          scroll={adminTableScroll}
        />
      </Card>
    </TenantSelectionGuard>
  );
};

export default ContactsPage;
