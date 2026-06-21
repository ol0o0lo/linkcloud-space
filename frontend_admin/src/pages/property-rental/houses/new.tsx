import { useMutation, useQuery } from '@tanstack/react-query';
import { history } from '@umijs/max';
import { Button, Card, Form, Input, Select, Space, Steps, message } from 'antd';
import React, { useEffect } from 'react';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi } from '@/services/manual/house';
import MediaRefsUpload from '../components/MediaRefsUpload';
import { HOUSE_MEDIA_RESOURCE_TYPE, HOUSE_MEDIA_TYPE } from '../constants';

const HouseNewPage: React.FC = () => {
  const [form] = Form.useForm();
  const workspace = useTenantWorkspace();
  const enabled = Boolean(workspace.selectedOrgSlug);
  const buildings = useQuery({ queryKey: ['house', 'new', 'buildings', workspace.selectedOrgSlug], queryFn: () => houseApi.listBuildings({ page: 1, page_size: 100 }), enabled });
  const contacts = useQuery({ queryKey: ['house', 'new', 'contacts', workspace.selectedOrgSlug], queryFn: () => houseApi.listContacts({ page: 1, page_size: 100, role: 'landlord' }), enabled });
  const createHouse = useMutation({
    mutationFn: (values: Record<string, unknown>) => houseApi.createHouse(values),
    onSuccess: (house) => {
      message.success('房源已创建');
      history.push(`/property-rental/houses/${house.id}`);
    },
  });

  useEffect(() => {
    const firstBuilding = buildings.data?.items?.[0];
    const firstContact = contacts.data?.items?.[0];
    form.setFieldsValue({
      building_id: form.getFieldValue('building_id') || firstBuilding?.id,
      landlord_id: form.getFieldValue('landlord_id') || firstContact?.id,
    });
  }, [buildings.data, contacts.data, form]);

  const submit = (values: Record<string, unknown>) => {
    const payload = {
      ...values,
      building_id: values.building_id || buildings.data?.items?.[0]?.id,
      landlord_id: values.landlord_id || contacts.data?.items?.[0]?.id,
    };
    createHouse.mutate(payload);
  };

  return (
    <TenantSelectionGuard title="新建房源" subtitle="先完成可保存的建档，再进入详情页继续补媒体和发布。">
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Steps
          current={0}
          items={[{ title: '位置' }, { title: '基础资料' }, { title: '房东' }, { title: '媒体' }, { title: '保存' }]}
        />
        <Card title="房源建档">
          <Form form={form} layout="vertical" onFinish={submit}>
            <Form.Item label="楼栋" name="building_id">
              <Select loading={buildings.isLoading} options={(buildings.data?.items || []).map((item) => ({ value: item.id, label: item.name }))} />
            </Form.Item>
            <Form.Item label="房东" name="landlord_id">
              <Select allowClear loading={contacts.isLoading} options={(contacts.data?.items || []).map((item) => ({ value: item.id, label: item.name }))} />
            </Form.Item>
            <Form.Item label="房号" name="room_number" rules={[{ required: true, message: '请输入房号' }]}>
              <Input />
            </Form.Item>
            <Form.Item label="挂牌租金" name="asking_rent">
              <Input />
            </Form.Item>
            <Form.Item label="押金" name="deposit_amount">
              <Input />
            </Form.Item>
            <Form.Item label="可租日期" name="available_from">
              <Input type="date" />
            </Form.Item>
            <Form.Item label="图片" name="images">
              <MediaRefsUpload resourceType={HOUSE_MEDIA_RESOURCE_TYPE.HOUSE_IMAGE} mediaType={HOUSE_MEDIA_TYPE.IMAGE} />
            </Form.Item>
            <Form.Item label="视频" name="videos">
              <MediaRefsUpload resourceType={HOUSE_MEDIA_RESOURCE_TYPE.HOUSE_VIDEO} mediaType={HOUSE_MEDIA_TYPE.VIDEO} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={createHouse.isPending} disabled={buildings.isLoading}>
              保存房源
            </Button>
          </Form>
        </Card>
      </Space>
    </TenantSelectionGuard>
  );
};

export default HouseNewPage;
