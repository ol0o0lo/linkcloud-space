import { useMutation, useQuery } from '@tanstack/react-query';
import { history } from '@umijs/max';
import { Button, Card, Form, Input, Modal, Select, Space, message } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/tenant/shared';
import { houseApi } from '@/services/manual/house';
import MediaRefsUpload from '../components/MediaRefsUpload';
import { HOUSE_MEDIA_RESOURCE_TYPE, HOUSE_MEDIA_TYPE } from '../constants';

const HouseNewPage: React.FC = () => {
  const [form] = Form.useForm();
  const [buildingForm] = Form.useForm();
  const [buildingOpen, setBuildingOpen] = useState(false);
  const [createdBuildings, setCreatedBuildings] = useState<{ id: number; name: string; estate_id: number }[]>([]);
  const workspace = useTenantWorkspace();
  const enabled = Boolean(workspace.selectedOrgSlug);
  const estates = useQuery({ queryKey: ['house', 'new', 'estates', workspace.selectedOrgSlug], queryFn: () => houseApi.listEstates({ page: 1, page_size: 100 }), enabled });
  const buildings = useQuery({ queryKey: ['house', 'new', 'buildings', workspace.selectedOrgSlug], queryFn: () => houseApi.listBuildings({ page: 1, page_size: 100 }), enabled });
  const defaultBuilding = useQuery({ queryKey: ['house', 'new', 'default-building', workspace.selectedOrgSlug], queryFn: () => houseApi.getDefaultBuilding(), enabled });
  const contacts = useQuery({ queryKey: ['house', 'new', 'contacts', workspace.selectedOrgSlug], queryFn: () => houseApi.listContacts({ page: 1, page_size: 100, role: 'landlord' }), enabled });
  const buildingItems = useMemo(() => [...createdBuildings, ...(buildings.data?.items || [])], [buildings.data, createdBuildings]);
  const createHouse = useMutation({
    mutationFn: (values: Record<string, unknown>) => houseApi.createHouse(values),
    onSuccess: (house) => {
      message.success('房源已创建');
      history.push(`/property-rental/houses/${house.id}`);
    },
  });
  const createBuilding = useMutation({
    mutationFn: (values: Record<string, unknown>) => houseApi.createBuilding(values),
    onSuccess: (building) => {
      setCreatedBuildings((items) => [building, ...items]);
      form.setFieldValue('building_id', building.id);
      houseApi.setDefaultBuilding(building.id);
      setBuildingOpen(false);
      buildingForm.resetFields();
    },
  });
  const setDefaultBuilding = useMutation({
    mutationFn: (buildingId: number) => houseApi.setDefaultBuilding(buildingId),
    onSuccess: () => message.success('默认楼栋已更新'),
  });

  useEffect(() => {
    const firstBuilding = buildingItems.find((item) => item.id === defaultBuilding.data?.id) || buildingItems[0];
    const firstContact = contacts.data?.items?.[0];
    form.setFieldsValue({
      building_id: form.getFieldValue('building_id') || firstBuilding?.id,
      landlord_id: form.getFieldValue('landlord_id') || firstContact?.id,
    });
  }, [buildingItems, contacts.data, defaultBuilding.data, form]);

  const submit = (values: Record<string, unknown>) => {
    const buildingId = values.building_id || buildingItems[0]?.id;
    if (!buildingId) {
      setBuildingOpen(true);
      return;
    }
    const payload = {
      ...values,
      building_id: buildingId,
      landlord_id: values.landlord_id || contacts.data?.items?.[0]?.id,
    };
    createHouse.mutate(payload);
  };

  return (
    <TenantSelectionGuard title="新建房源" subtitle="先完成可保存的建档，再进入详情页继续补媒体和发布。">
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Card title="房源建档">
          <Form form={form} layout="vertical" onFinish={submit}>
            <Form.Item label="楼栋">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="building_id" noStyle>
                  <Select loading={buildings.isLoading} options={buildingItems.map((item) => ({ value: item.id, label: item.name }))} />
                </Form.Item>
                <Button onClick={() => setDefaultBuilding.mutate(form.getFieldValue('building_id'))} disabled={!form.getFieldValue('building_id')} loading={setDefaultBuilding.isPending}>
                  设为默认
                </Button>
                <Button onClick={() => setBuildingOpen(true)}>新建楼栋</Button>
              </Space.Compact>
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
      <Modal
        title="新建楼栋"
        open={buildingOpen}
        onCancel={() => setBuildingOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={buildingForm}
          layout="vertical"
          initialValues={{ estate_id: estates.data?.items?.[0]?.id, floors: 1 }}
          onFinish={(values) => createBuilding.mutate({ ...values, estate_id: values.estate_id || estates.data?.items?.[0]?.id, floors: Number(values.floors) })}
        >
          <Form.Item label="项目小区" name="estate_id">
            <Select loading={estates.isLoading} options={(estates.data?.items || []).map((item) => ({ value: item.id, label: item.name }))} />
          </Form.Item>
          <Form.Item label="楼栋名" name="name" rules={[{ required: true, message: '请输入楼栋名' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="楼层" name="floors" rules={[{ required: true, message: '请输入楼层' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="地址" name="address">
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={createBuilding.isPending}>
            保存楼栋
          </Button>
        </Form>
      </Modal>
    </TenantSelectionGuard>
  );
};

export default HouseNewPage;
