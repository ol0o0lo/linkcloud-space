import { UploadOutlined } from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PageContainer } from '@ant-design/pro-components';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Row,
  Space,
  Statistic,
  Switch,
  Typography,
  Upload,
  message,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import React, { useState } from 'react';
import {
  codeWrapStyle,
  fullWidthStyle,
  wrapTextStyle,
} from '@/pages/_shared/adminLayout';
import {
  appsBaseApiGetVersion,
  appsBaseApiSendTestNotification,
  appsBaseApiTestNotificationsStaffUsers,
} from '@/services/openapi/appSystem';
import {
  appsMediaApiConfirmUpload,
  appsMediaApiOssToken,
  appsMediaApiUploadFiles,
} from '@/services/openapi/mediaFiles';

const sectionStyle: React.CSSProperties = {
  padding: 20,
  border: '1px solid var(--ant-color-border-secondary)',
  borderRadius: 8,
  background: 'var(--ant-color-fill-quaternary)',
};

const overviewTileStyle: React.CSSProperties = {
  height: '100%',
  padding: 16,
  borderRadius: 8,
  border: '1px solid var(--ant-color-border-secondary)',
  background: 'var(--ant-color-bg-container)',
};

const SystemOperationsPage: React.FC = () => {
  const [notifyForm] = Form.useForm<API.TestNotificationIn>();
  const [tokenForm] = Form.useForm<{
    token_resource_type: string;
    filename: string;
    scope: 'user' | 'org';
  }>();
  const [serverUploadForm] = Form.useForm<{
    server_resource_type: string;
    scope: string;
  }>();
  const [confirmForm] = Form.useForm<
    Omit<API.MediaFileConfirmIn, 'resource_type'> & {
      confirm_resource_type: string;
    }
  >();
  const [serverUploadFileList, setServerUploadFileList] = useState<
    UploadFile[]
  >([]);

  const versionQuery = useQuery({
    queryKey: ['system-tools', 'version'],
    queryFn: () => appsBaseApiGetVersion(),
  });
  const staffQuery = useQuery({
    queryKey: ['system-tools', 'staff-users'],
    queryFn: () => appsBaseApiTestNotificationsStaffUsers(),
  });
  const notificationMutation = useMutation({
    mutationFn: (payload: API.TestNotificationIn) =>
      appsBaseApiSendTestNotification(payload),
  });
  const tokenMutation = useMutation({
    mutationFn: (payload: {
      resource_type: string;
      filename: string;
      scope: 'user' | 'org';
    }) => appsMediaApiOssToken(payload),
  });
  const serverUploadMutation = useMutation({
    mutationFn: ({
      body,
      files,
    }: {
      body: { resource_type: string; scope?: string };
      files: File[];
    }) => appsMediaApiUploadFiles(body, files),
    onSuccess: () => {
      message.success('服务端上传完成');
      setServerUploadFileList([]);
      serverUploadForm.resetFields();
    },
  });
  const confirmMutation = useMutation({
    mutationFn: (payload: API.MediaFileConfirmIn) =>
      appsMediaApiConfirmUpload(payload),
  });

  const versionText =
    typeof versionQuery.data === 'string'
      ? versionQuery.data
      : versionQuery.data?.version;
  const staffUsers = staffQuery.data || [];
  const staffUserLabel =
    staffUsers
      .map((user: any) => user.username || user.email || user.id)
      .join('、') || '-';
  const notificationChannelCount = 2;
  const uploadToolCount = 3;

  return (
    <PageContainer title="系统运维台" subTitle="查看版本并演练通知与上传链路。">
      <Space orientation="vertical" size={16} style={fullWidthStyle}>
        <Card>
          <div style={sectionStyle}>
            <Typography.Text strong>运维概览</Typography.Text>
            <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic
                    title="系统版本"
                    value={versionText || 'unknown'}
                    styles={{ content: { fontSize: 20 } }}
                  />
                  <Typography.Text type="secondary">
                    版本号用于确认当前联调和排障面对的是哪套环境。
                  </Typography.Text>
                </div>
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic title="可演练账号" value={staffUsers.length} />
                  <Typography.Text type="secondary">
                    这些账号可用于通知联调和基础后台运维演练。
                  </Typography.Text>
                </div>
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic
                    title="通知通道"
                    value={notificationChannelCount}
                  />
                  <Typography.Text type="secondary">
                    当前演练覆盖邮件和站内两种触达方式。
                  </Typography.Text>
                </div>
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <div style={overviewTileStyle}>
                  <Statistic title="上传链路段数" value={uploadToolCount} />
                  <Typography.Text type="secondary">
                    上传凭证、服务端上传、媒体登记对应三段不同问题域。
                  </Typography.Text>
                </div>
              </Col>
            </Row>
          </div>

          <div style={{ ...sectionStyle, marginTop: 16 }}>
            <Space orientation="vertical" size={12} style={fullWidthStyle}>
              <div>
                <Typography.Text strong>基础元数据</Typography.Text>
              </div>
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="版本">
                  {versionText || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="测试通知用户">
                  <span style={wrapTextStyle}>{staffUserLabel}</span>
                </Descriptions.Item>
              </Descriptions>
            </Space>
          </div>
        </Card>

        <Card title="通知演练台">
          <Form
            name="notify-form"
            form={notifyForm}
            layout="vertical"
            initialValues={{ send_email: true, send_in_app: true }}
            onFinish={(values) =>
              notificationMutation.mutate({
                ...values,
                user_id: Number(values.user_id),
              })
            }
          >
            <Row gutter={16} align="bottom">
              <Col xs={24} md={8}>
                <Form.Item
                  label="测试通知用户 ID"
                  name="user_id"
                  rules={[{ required: true, message: '请输入用户 ID' }]}
                >
                  <InputNumber min={1} style={fullWidthStyle} />
                </Form.Item>
              </Col>
              <Col xs={12} md={4}>
                <Form.Item
                  label="邮件"
                  name="send_email"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </Col>
              <Col xs={12} md={4}>
                <Form.Item
                  label="站内"
                  name="send_in_app"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={notificationMutation.isPending}
                >
                  发送测试通知
                </Button>
              </Col>
            </Row>
          </Form>
        </Card>

        <Card title="媒体上传链路演练">
          <Space orientation="vertical" size={16} style={fullWidthStyle}>
            <div style={sectionStyle}>
              <Typography.Text strong>上传凭证阶段</Typography.Text>
              <Typography.Paragraph
                type="secondary"
                style={{ marginBottom: 0, marginTop: 8 }}
              >
                这里验证的是前端直传前需要的 OSS / S3 凭证能不能正常拿到。
              </Typography.Paragraph>
              <Form
                name="token-form"
                form={tokenForm}
                layout="vertical"
                initialValues={{ scope: 'user' }}
                onFinish={(values) =>
                  tokenMutation.mutate({
                    resource_type: values.token_resource_type,
                    filename: values.filename,
                    scope: values.scope,
                  })
                }
              >
                <Row gutter={16} align="bottom">
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="资源类型"
                      name="token_resource_type"
                      rules={[{ required: true, message: '请输入资源类型' }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="文件名"
                      name="filename"
                      rules={[{ required: true, message: '请输入文件名' }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={4}>
                    <Form.Item label="上传凭证作用域" name="scope">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={4}>
                    <Button htmlType="submit" loading={tokenMutation.isPending}>
                      获取上传凭证
                    </Button>
                  </Col>
                </Row>
              </Form>
              {tokenMutation.data ? (
                <div style={{ marginTop: 16 }}>
                  <Typography.Text strong>最近凭证结果</Typography.Text>
                  <Descriptions
                    column={1}
                    bordered
                    size="small"
                    style={{ marginTop: 12 }}
                  >
                    <Descriptions.Item label="路径">
                      {String(
                        (tokenMutation.data as Record<string, unknown>).path ||
                          '-',
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Bucket">
                      {String(
                        (tokenMutation.data as Record<string, unknown>)
                          .bucket || '-',
                      )}
                    </Descriptions.Item>
                  </Descriptions>
                  <Typography.Text
                    code
                    style={{
                      ...codeWrapStyle,
                      display: 'block',
                      marginTop: 12,
                    }}
                  >
                    {JSON.stringify(tokenMutation.data)}
                  </Typography.Text>
                </div>
              ) : null}
            </div>

            <div style={sectionStyle}>
              <Typography.Text strong>服务端上传阶段</Typography.Text>
              <Typography.Paragraph
                type="secondary"
                style={{ marginBottom: 0, marginTop: 8 }}
              >
                这里验证的是文件是否能绕过前端直传，直接通过服务端上传链路落库。
              </Typography.Paragraph>
              <Form
                name="server-upload-form"
                form={serverUploadForm}
                layout="vertical"
                initialValues={{ scope: 'user' }}
                onFinish={async (values) => {
                  const files = serverUploadFileList
                    .map((file) => file.originFileObj)
                    .filter(Boolean) as File[];
                  if (!files.length) {
                    message.warning('请选择要上传的文件');
                    return;
                  }
                  await serverUploadMutation.mutateAsync({
                    body: {
                      resource_type: values.server_resource_type,
                      scope: values.scope,
                    },
                    files,
                  });
                }}
              >
                <Row gutter={16} align="bottom">
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="服务端上传资源类型"
                      name="server_resource_type"
                      rules={[{ required: true, message: '请输入资源类型' }]}
                    >
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
                        onChange={({ fileList }) =>
                          setServerUploadFileList(fileList)
                        }
                      >
                        <Button icon={<UploadOutlined />}>选择文件</Button>
                      </Upload>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={4}>
                    <Button
                      htmlType="submit"
                      loading={serverUploadMutation.isPending}
                    >
                      服务端上传
                    </Button>
                  </Col>
                </Row>
              </Form>
              {serverUploadMutation.data ? (
                <div style={{ marginTop: 16 }}>
                  <Typography.Text strong>最近服务端上传结果</Typography.Text>
                  <Descriptions
                    column={1}
                    bordered
                    size="small"
                    style={{ marginTop: 12 }}
                  >
                    <Descriptions.Item label="返回数量">
                      {Array.isArray(serverUploadMutation.data)
                        ? serverUploadMutation.data.length
                        : 0}
                    </Descriptions.Item>
                    <Descriptions.Item label="首个文件">
                      {Array.isArray(serverUploadMutation.data)
                        ? String(
                            serverUploadMutation.data[0]?.original_filename ||
                              '-',
                          )
                        : '-'}
                    </Descriptions.Item>
                  </Descriptions>
                  <Typography.Text
                    code
                    style={{
                      ...codeWrapStyle,
                      display: 'block',
                      marginTop: 12,
                    }}
                  >
                    {JSON.stringify(serverUploadMutation.data)}
                  </Typography.Text>
                </div>
              ) : null}
            </div>

            <div style={sectionStyle}>
              <Typography.Text strong>媒体登记阶段</Typography.Text>
              <Typography.Paragraph
                type="secondary"
                style={{ marginBottom: 0, marginTop: 8 }}
              >
                这里验证的是 OSS 文件路径能否正确登记成平台可识别的媒体记录。
              </Typography.Paragraph>
              <Form
                name="confirm-form"
                form={confirmForm}
                layout="vertical"
                onFinish={(values) => {
                  const { confirm_resource_type: resourceType, ...payload } =
                    values;
                  confirmMutation.mutate({
                    ...payload,
                    resource_type: resourceType,
                    file_size: Number(values.file_size),
                  });
                }}
              >
                <Row gutter={16} align="bottom">
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="OSS 路径"
                      name="oss_path"
                      rules={[{ required: true, message: '请输入 OSS 路径' }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item
                      label="原始文件名"
                      name="original_filename"
                      rules={[{ required: true, message: '请输入原始文件名' }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={5}>
                    <Form.Item
                      label="登记资源类型"
                      name="confirm_resource_type"
                      rules={[{ required: true, message: '请输入资源类型' }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={5}>
                    <Form.Item
                      label="文件大小"
                      name="file_size"
                      rules={[{ required: true, message: '请输入文件大小' }]}
                    >
                      <InputNumber min={0} style={fullWidthStyle} />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Button
                      htmlType="submit"
                      loading={confirmMutation.isPending}
                    >
                      登记媒体文件
                    </Button>
                  </Col>
                </Row>
              </Form>
              {confirmMutation.data ? (
                <div style={{ marginTop: 16 }}>
                  <Typography.Text strong>最近媒体登记结果</Typography.Text>
                  <Descriptions
                    column={1}
                    bordered
                    size="small"
                    style={{ marginTop: 12 }}
                  >
                    <Descriptions.Item label="文件名">
                      {String(
                        (confirmMutation.data as Record<string, unknown>)
                          .original_filename || '-',
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="资源类型">
                      {String(
                        (confirmMutation.data as Record<string, unknown>)
                          .resource_type || '-',
                      )}
                    </Descriptions.Item>
                  </Descriptions>
                  <Typography.Text
                    code
                    style={{
                      ...codeWrapStyle,
                      display: 'block',
                      marginTop: 12,
                    }}
                  >
                    {JSON.stringify(confirmMutation.data)}
                  </Typography.Text>
                </div>
              ) : null}
            </div>
          </Space>
        </Card>
      </Space>
    </PageContainer>
  );
};

export default SystemOperationsPage;
