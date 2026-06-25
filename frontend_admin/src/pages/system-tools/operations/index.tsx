import { UploadOutlined } from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Descriptions, Form, Input, InputNumber, Row, Space, Statistic, Switch, Tag, Typography, Upload, message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import React, { useEffect, useMemo, useState } from 'react';
import { codeWrapStyle, fullWidthStyle, wrapTextStyle } from '@/pages/_shared/adminLayout';
import {
  appsBaseApiGetVersion,
  appsBaseApiSendTestNotification,
  appsBaseApiTestNotificationsStaffUsers,
} from '@/services/openapi/appSystem';
import { appsMediaApiConfirmUpload, appsMediaApiOssToken, appsMediaApiUploadFiles } from '@/services/openapi/mediaFiles';

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

const mediaTemplates = [
  {
    key: 'house_image',
    label: '房源图片直传',
    description: '适合演练房源封面图、室内图等组织级媒体上传。',
    resourceType: 'house_image',
    scope: 'org',
    filename: 'house-cover.jpg',
    ossPath: 'uploads/orgs/<org_id>/house-cover.jpg',
    fileSize: 256000,
  },
  {
    key: 'house_video',
    label: '房源视频上传',
    description: '适合验证房源视频是否能被正确申请凭证、上传并登记。',
    resourceType: 'house_video',
    scope: 'org',
    filename: 'house-tour.mp4',
    ossPath: 'uploads/orgs/<org_id>/house-tour.mp4',
    fileSize: 2097152,
  },
  {
    key: 'lease_contract',
    label: '租约合同登记',
    description: '适合排查合同文件上传与登记链路。',
    resourceType: 'lease_contract',
    scope: 'org',
    filename: 'lease-contract.pdf',
    ossPath: 'uploads/orgs/<org_id>/lease-contract.pdf',
    fileSize: 524288,
  },
  {
    key: 'avatar',
    label: '头像上传',
    description: '适合验证用户级上传链路。',
    resourceType: 'avatar',
    scope: 'user',
    filename: 'avatar.png',
    ossPath: 'uploads/users/<user_id>/avatar.png',
    fileSize: 128000,
  },
] as const;

const SystemOperationsPage: React.FC = () => {
  const [notifyForm] = Form.useForm<API.TestNotificationIn>();
  const [tokenForm] = Form.useForm<{ token_resource_type: string; filename: string; scope: 'user' | 'org' }>();
  const [serverUploadForm] = Form.useForm<{ server_resource_type: string; scope: string }>();
  const [confirmForm] = Form.useForm<Omit<API.MediaFileConfirmIn, 'resource_type'> & { confirm_resource_type: string }>();
  const [serverUploadFileList, setServerUploadFileList] = useState<UploadFile[]>([]);
  const [activeTemplateKey, setActiveTemplateKey] = useState<string>('house_image');

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
  const staffUsers = staffQuery.data || [];
  const staffUserLabel = staffUsers.map((user: any) => user.username || user.email || user.id).join('、') || '-';
  const versionStatus = versionText && versionText !== 'unknown' ? '已识别' : '待确认';
  const versionStatusColor = versionText && versionText !== 'unknown' ? 'green' : 'gold';
  const notificationChannelCount = 2;
  const uploadToolCount = 3;
  const activeTemplate = mediaTemplates.find((item) => item.key === activeTemplateKey) || mediaTemplates[0];
  const currentRisks = [
    ...(versionStatus === '待确认' ? ['当前环境版本未识别，先确认部署版本再做后续联调。'] : []),
    ...(staffUsers.length === 0 ? ['当前没有可用的后台演练账号，通知联调会停留在接口提交层。'] : []),
  ];

  const signals = useMemo(
    () => [
      {
        title: '测试通知链路',
        emphasis: staffUsers.length ? `${staffUsers.length} 个可演练账号` : '当前无演练账号',
        summary: staffUsers.length ? '通知演练链路可用，适合继续验证邮件与站内触达。' : '当前没有可用演练账号，通知联调会受限。',
        description: '系统工具页不只是按钮集合，它至少要告诉值班人员有没有真实可用的演练对象。',
      },
      {
        title: '媒体上传链路',
        emphasis: uploadToolCount ? `${uploadToolCount} 段上传辅助` : '上传链路未配置',
        summary: '当前支持凭证、服务端上传和登记三段辅助，便于排查上传链路不同节点。',
        description: '把上传链路拆开，比只给一个大表单更适合定位问题落在哪一段。',
      },
      {
        title: '系统版本识别',
        emphasis: versionStatus,
        summary: versionStatus === '已识别' ? '当前可以明确知道环境版本，便于联调和问题留痕。' : '当前版本信息没有明确返回，后续排查最好先确认部署来源。',
        description: '版本号不是装饰，它决定了调试结果是否能和当前环境真正对应。',
      },
    ],
    [staffUsers.length, uploadToolCount, versionStatus],
  );

  const applyTemplate = (templateKey: string) => {
    const template = mediaTemplates.find((item) => item.key === templateKey);
    if (!template) return;
    setActiveTemplateKey(template.key);
    tokenForm.setFieldsValue({
      token_resource_type: template.resourceType,
      filename: template.filename,
      scope: template.scope,
    });
    serverUploadForm.setFieldsValue({
      server_resource_type: template.resourceType,
      scope: template.scope,
    });
    confirmForm.setFieldsValue({
      confirm_resource_type: template.resourceType,
      original_filename: template.filename,
      oss_path: template.ossPath,
      file_size: template.fileSize,
    });
  };

  useEffect(() => {
    applyTemplate(activeTemplateKey);
  }, []);

  return (
    <Space orientation="vertical" size={16} style={fullWidthStyle}>
      <Card title="系统运维台">
        <div style={sectionStyle}>
          <Typography.Text strong>运维概览</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="系统版本" value={versionText || 'unknown'} styles={{ content: { fontSize: 20 } }} />
                <Typography.Text type="secondary">版本号用于确认当前联调和排障面对的是哪套环境。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="可演练账号" value={staffUsers.length} />
                <Typography.Text type="secondary">这些账号可用于通知联调和基础后台运维演练。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="通知通道" value={notificationChannelCount} />
                <Typography.Text type="secondary">当前演练覆盖邮件和站内两种触达方式。</Typography.Text>
              </div>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <div style={overviewTileStyle}>
                <Statistic title="上传链路段数" value={uploadToolCount} />
                <Typography.Text type="secondary">上传凭证、服务端上传、媒体登记对应三段不同问题域。</Typography.Text>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>当前执行面</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            <Col xs={24} md={12} xl={8}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>环境识别</Typography.Text>
                    <Typography.Text type="secondary">{versionStatus}</Typography.Text>
                  </Space>
                  <Typography.Text>当前环境版本 {versionText || 'unknown'}，先确认版本，再做通知和上传链路联调，能减少误判。</Typography.Text>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={8}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>通知演练</Typography.Text>
                    <Typography.Text type="secondary">{staffUsers.length ? `${staffUsers.length} 个账号可测` : '暂无可测账号'}</Typography.Text>
                  </Space>
                  <Typography.Text>通知联调至少要知道有哪些真实后台账号可用，否则测试动作很容易只停留在表单提交成功。</Typography.Text>
                </Space>
              </div>
            </Col>
            <Col xs={24} md={12} xl={8}>
              <div style={overviewTileStyle}>
                <Space orientation="vertical" size={8}>
                  <Space wrap size={[8, 8]}>
                    <Typography.Text strong>上传链路</Typography.Text>
                    <Typography.Text type="secondary">凭证 / 上传 / 登记</Typography.Text>
                  </Space>
                  <Typography.Text>媒体上传问题往往卡在链路中间某一段，拆开演练比把所有字段堆在一个表单里更可靠。</Typography.Text>
                </Space>
              </div>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Typography.Text strong>闭环信号</Typography.Text>
          <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
            {signals.map((signal) => (
              <Col key={signal.title} xs={24} sm={12} xl={8}>
                <div style={overviewTileStyle}>
                  <Space orientation="vertical" size={8}>
                    <Typography.Text strong>{signal.title}</Typography.Text>
                    <Tag color={signal.title === '系统版本识别' ? versionStatusColor : 'blue'}>{signal.emphasis}</Tag>
                    <Typography.Text>{signal.summary}</Typography.Text>
                    <Typography.Text type="secondary">{signal.description}</Typography.Text>
                  </Space>
                </div>
              </Col>
            ))}
          </Row>
        </div>

        <div style={{ ...sectionStyle, marginTop: 16 }}>
          <Space orientation="vertical" size={12} style={fullWidthStyle}>
            <div>
              <Typography.Text strong>基础元数据</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
                运维页至少要先讲清楚当前版本和哪些账号可用于联调，而不是直接把测试表单丢给使用者。
              </Typography.Paragraph>
            </div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="版本">{versionText || '-'}</Descriptions.Item>
              <Descriptions.Item label="测试通知用户">
                <span style={wrapTextStyle}>{staffUserLabel}</span>
              </Descriptions.Item>
            </Descriptions>
          </Space>
        </div>
      </Card>

      <Card title="通知演练台">
        <Alert type="info" showIcon title="通知演练不只是验证接口有没有返回成功，更重要的是确认选定账号能否真正收到邮件或站内提醒。" style={{ marginBottom: 16 }} />
        <Form name="notify-form" form={notifyForm} layout="vertical" initialValues={{ send_email: true, send_in_app: true }} onFinish={(values) => notificationMutation.mutate({ ...values, user_id: Number(values.user_id) })}>
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
              <Button type="primary" htmlType="submit" loading={notificationMutation.isPending}>
                发送测试通知
              </Button>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card title="媒体上传链路演练">
        <Space orientation="vertical" size={16} style={fullWidthStyle}>
          <div style={sectionStyle}>
            <Space orientation="vertical" size={12} style={fullWidthStyle}>
              <div>
                <Typography.Text strong>当前风险</Typography.Text>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
                  先确认当前环境和演练对象，再决定是排查通知还是上传链路，否则很容易把问题误判到错误环节。
                </Typography.Paragraph>
              </div>
              <Alert
                type={currentRisks.length ? 'warning' : 'success'}
                showIcon
                title={currentRisks.length ? '当前仍有待确认项' : '当前可以继续演练'}
                description={currentRisks.length ? (
                  <ul style={{ margin: 0, paddingInlineStart: 20 }}>
                    {currentRisks.map((risk) => (
                      <li key={risk}>{risk}</li>
                    ))}
                  </ul>
                ) : '版本和演练账号都已具备，可以按模板直接验证通知与媒体链路。'}
              />
            </Space>
          </div>

          <div style={sectionStyle}>
            <Space orientation="vertical" size={12} style={fullWidthStyle}>
              <div>
                <Typography.Text strong>常用演练模板</Typography.Text>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
                  这些模板会同时填充凭证、服务端上传和媒体登记三段参数，减少重复录入，也更符合租房房源后台的常见排查场景。
                </Typography.Paragraph>
              </div>
              <Space wrap size={[8, 8]}>
                {mediaTemplates.map((template) => (
                  <Button key={template.key} type={activeTemplate.key === template.key ? 'primary' : 'default'} onClick={() => applyTemplate(template.key)}>
                    {template.label}
                  </Button>
                ))}
              </Space>
              <Alert
                type="info"
                showIcon
                title={activeTemplate.label}
                description={`${activeTemplate.description} 当前预填：${activeTemplate.resourceType} / ${activeTemplate.scope} / ${activeTemplate.filename}`}
              />
            </Space>
          </div>

          <div style={sectionStyle}>
            <Typography.Text strong>上传凭证阶段</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
              这里验证的是前端直传前需要的 OSS / S3 凭证能不能正常拿到。
            </Typography.Paragraph>
            <Form
              name="token-form"
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
                <Descriptions column={1} bordered size="small" style={{ marginTop: 12 }}>
                  <Descriptions.Item label="路径">{String((tokenMutation.data as Record<string, unknown>).path || '-')}</Descriptions.Item>
                  <Descriptions.Item label="Bucket">{String((tokenMutation.data as Record<string, unknown>).bucket || '-')}</Descriptions.Item>
                </Descriptions>
                <Typography.Text code style={{ ...codeWrapStyle, display: 'block', marginTop: 12 }}>{JSON.stringify(tokenMutation.data)}</Typography.Text>
              </div>
            ) : null}
          </div>

          <div style={sectionStyle}>
            <Typography.Text strong>服务端上传阶段</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
              这里验证的是文件是否能绕过前端直传，直接通过服务端上传链路落库。
            </Typography.Paragraph>
            <Form
              name="server-upload-form"
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
                    <Upload multiple beforeUpload={() => false} fileList={serverUploadFileList} onChange={({ fileList }) => setServerUploadFileList(fileList)}>
                      <Button icon={<UploadOutlined />}>选择文件</Button>
                    </Upload>
                  </Form.Item>
                </Col>
                <Col xs={24} md={4}>
                  <Button htmlType="submit" loading={serverUploadMutation.isPending}>
                    服务端上传
                  </Button>
                </Col>
              </Row>
            </Form>
            {serverUploadMutation.data ? (
              <div style={{ marginTop: 16 }}>
                <Typography.Text strong>最近服务端上传结果</Typography.Text>
                <Descriptions column={1} bordered size="small" style={{ marginTop: 12 }}>
                  <Descriptions.Item label="返回数量">{Array.isArray(serverUploadMutation.data) ? serverUploadMutation.data.length : 0}</Descriptions.Item>
                  <Descriptions.Item label="首个文件">{Array.isArray(serverUploadMutation.data) ? String(serverUploadMutation.data[0]?.original_filename || '-') : '-'}</Descriptions.Item>
                </Descriptions>
                <Typography.Text code style={{ ...codeWrapStyle, display: 'block', marginTop: 12 }}>{JSON.stringify(serverUploadMutation.data)}</Typography.Text>
              </div>
            ) : null}
          </div>

          <div style={sectionStyle}>
            <Typography.Text strong>媒体登记阶段</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
              这里验证的是 OSS 文件路径能否正确登记成平台可识别的媒体记录。
            </Typography.Paragraph>
            <Form
              name="confirm-form"
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
                  <Button htmlType="submit" loading={confirmMutation.isPending}>
                    登记媒体文件
                  </Button>
                </Col>
              </Row>
            </Form>
            {confirmMutation.data ? (
              <div style={{ marginTop: 16 }}>
                <Typography.Text strong>最近媒体登记结果</Typography.Text>
                <Descriptions column={1} bordered size="small" style={{ marginTop: 12 }}>
                  <Descriptions.Item label="文件名">{String((confirmMutation.data as Record<string, unknown>).original_filename || '-')}</Descriptions.Item>
                  <Descriptions.Item label="资源类型">{String((confirmMutation.data as Record<string, unknown>).resource_type || '-')}</Descriptions.Item>
                </Descriptions>
                <Typography.Text code style={{ ...codeWrapStyle, display: 'block', marginTop: 12 }}>{JSON.stringify(confirmMutation.data)}</Typography.Text>
              </div>
            ) : null}
          </div>
        </Space>
      </Card>
    </Space>
  );
};

export default SystemOperationsPage;
