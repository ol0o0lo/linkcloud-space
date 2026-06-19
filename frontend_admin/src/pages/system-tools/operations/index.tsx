import { UploadOutlined } from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Col, Descriptions, Form, Input, InputNumber, Row, Space, Switch, Typography, Upload, message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import React, { useState } from 'react';
import { codeWrapStyle, fullWidthStyle, wrapTextStyle } from '@/pages/_shared/adminLayout';
import {
  appsBaseApiGetVersion,
  appsBaseApiSendTestNotification,
  appsBaseApiTestNotificationsStaffUsers,
} from '@/services/openapi/appSystem';
import { appsMediaApiConfirmUpload, appsMediaApiOssToken, appsMediaApiUploadFiles } from '@/services/openapi/mediaFiles';

const SystemOperationsPage: React.FC = () => {
  const [notifyForm] = Form.useForm<API.TestNotificationIn>();
  const [tokenForm] = Form.useForm<{ token_resource_type: string; filename: string; scope: 'user' | 'org' }>();
  const [serverUploadForm] = Form.useForm<{ server_resource_type: string; scope: string }>();
  const [confirmForm] = Form.useForm<Omit<API.MediaFileConfirmIn, 'resource_type'> & { confirm_resource_type: string }>();
  const [serverUploadFileList, setServerUploadFileList] = useState<UploadFile[]>([]);

  const versionQuery = useQuery({ queryKey: ['system-tools', 'version'], queryFn: () => appsBaseApiGetVersion() });
  const staffQuery = useQuery({ queryKey: ['system-tools', 'staff-users'], queryFn: () => appsBaseApiTestNotificationsStaffUsers() });
  const notificationMutation = useMutation({ mutationFn: (payload: API.TestNotificationIn) => appsBaseApiSendTestNotification(payload) });
  const tokenMutation = useMutation({ mutationFn: (payload: { resource_type: string; filename: string; scope: 'user' | 'org' }) => appsMediaApiOssToken(payload) });
  const serverUploadMutation = useMutation({
    mutationFn: ({ body, files }: { body: { resource_type: string; scope?: string }; files: File[] }) => appsMediaApiUploadFiles(body, files),
    onSuccess: () => {
      message.success('服务端上传完成');
      setServerUploadFileList([]);
      serverUploadForm.resetFields();
    },
  });
  const confirmMutation = useMutation({ mutationFn: (payload: API.MediaFileConfirmIn) => appsMediaApiConfirmUpload(payload) });

  const versionText = typeof versionQuery.data === 'string' ? versionQuery.data : versionQuery.data?.version;

  return (
    <Space orientation="vertical" style={fullWidthStyle}>
      <Card title="系统信息">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="版本">{versionText || '-'}</Descriptions.Item>
          <Descriptions.Item label="测试通知用户"><span style={wrapTextStyle}>{(staffQuery.data || []).map((user: any) => user.username || user.email || user.id).join('、') || '-'}</span></Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="测试通知">
        <Form form={notifyForm} layout="vertical" initialValues={{ send_email: true, send_in_app: true }} onFinish={(values) => notificationMutation.mutate({ ...values, user_id: Number(values.user_id) })}>
          <Row gutter={16} align="bottom">
            <Col xs={24} md={8}>
              <Form.Item label="测试通知用户 ID" name="user_id" rules={[{ required: true, message: '请输入用户 ID' }]}>
                <InputNumber min={1} style={fullWidthStyle} />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item label="邮件" name="send_email" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item label="站内" name="send_in_app" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Button type="primary" htmlType="submit" loading={notificationMutation.isPending}>发送测试通知</Button>
            </Col>
          </Row>
        </Form>
      </Card>
      <Card title="媒体上传辅助">
        <Space orientation="vertical" style={fullWidthStyle}>
          <Form
            form={tokenForm}
            layout="vertical"
            initialValues={{ scope: 'user' }}
            onFinish={(values) => tokenMutation.mutate({ resource_type: values.token_resource_type, filename: values.filename, scope: values.scope })}
          >
            <Row gutter={16} align="bottom">
              <Col xs={24} md={8}>
                <Form.Item label="资源类型" name="token_resource_type" rules={[{ required: true, message: '请输入资源类型' }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="文件名" name="filename" rules={[{ required: true, message: '请输入文件名' }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <Form.Item label="作用域" name="scope">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <Button htmlType="submit" loading={tokenMutation.isPending}>获取上传凭证</Button>
              </Col>
            </Row>
          </Form>
          {tokenMutation.data ? <Typography.Text code style={codeWrapStyle}>{JSON.stringify(tokenMutation.data)}</Typography.Text> : null}
          <Form
            form={serverUploadForm}
            layout="vertical"
            initialValues={{ scope: 'user' }}
            onFinish={async (values) => {
              const files = serverUploadFileList.map((file) => file.originFileObj).filter(Boolean) as File[];
              if (!files.length) {
                message.warning('请选择要上传的文件');
                return;
              }
              await serverUploadMutation.mutateAsync({ body: { resource_type: values.server_resource_type, scope: values.scope }, files });
            }}
          >
            <Row gutter={16} align="bottom">
              <Col xs={24} md={8}>
                <Form.Item label="服务端上传资源类型" name="server_resource_type" rules={[{ required: true, message: '请输入资源类型' }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="服务端上传作用域" name="scope">
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="上传文件">
                  <Upload
                    multiple
                    beforeUpload={() => false}
                    fileList={serverUploadFileList}
                    onChange={({ fileList }) => setServerUploadFileList(fileList)}
                  >
                    <Button icon={<UploadOutlined />}>选择文件</Button>
                  </Upload>
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <Button htmlType="submit" loading={serverUploadMutation.isPending}>服务端上传</Button>
              </Col>
            </Row>
          </Form>
          {serverUploadMutation.data ? <Typography.Text code style={codeWrapStyle}>{JSON.stringify(serverUploadMutation.data)}</Typography.Text> : null}
          <Form
            form={confirmForm}
            layout="vertical"
            onFinish={(values) => {
              const { confirm_resource_type: resourceType, ...payload } = values;
              confirmMutation.mutate({ ...payload, resource_type: resourceType, file_size: Number(values.file_size) });
            }}
          >
            <Row gutter={16} align="bottom">
              <Col xs={24} md={8}>
                <Form.Item label="OSS 路径" name="oss_path" rules={[{ required: true, message: '请输入 OSS 路径' }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="原始文件名" name="original_filename" rules={[{ required: true, message: '请输入原始文件名' }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={5}>
                <Form.Item label="登记资源类型" name="confirm_resource_type" rules={[{ required: true, message: '请输入资源类型' }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={5}>
                <Form.Item label="文件大小" name="file_size" rules={[{ required: true, message: '请输入文件大小' }]}>
                  <InputNumber min={0} style={fullWidthStyle} />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Button htmlType="submit" loading={confirmMutation.isPending}>登记媒体文件</Button>
              </Col>
            </Row>
          </Form>
        </Space>
      </Card>
    </Space>
  );
};

export default SystemOperationsPage;
