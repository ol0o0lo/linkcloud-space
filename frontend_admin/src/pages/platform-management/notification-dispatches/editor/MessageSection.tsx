import { LinkOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Select, Typography } from 'antd';
import { useStyles } from '../styles';
import type { NotificationDispatchEditor } from './useNotificationDispatchEditor';

type MessageSectionProps = {
  editor: NotificationDispatchEditor;
};

const MessageSection = ({ editor }: MessageSectionProps) => {
  const { styles } = useStyles();

  return (
    <section className={styles.createSection} aria-labelledby="content-heading">
      <Typography.Title
        level={5}
        id="content-heading"
        className={styles.sectionTitle}
      >
        填写消息内容
      </Typography.Title>
      <Form.Item label="消息类型（可选）" name="category">
        <Select
          allowClear
          showSearch={{ optionFilterProp: 'label' }}
          options={editor.categoryOptions}
          loading={editor.isCategoryLoading}
          placeholder="选择消息类型（可不选）"
        />
      </Form.Item>
      <Form.Item
        label="标题"
        name="title"
        rules={[
          { required: true, message: '请输入标题' },
          { whitespace: true, message: '标题不能只包含空格' },
          { max: 255, message: '标题不能超过 255 个字符' },
        ]}
      >
        <Input
          allowClear
          maxLength={255}
          showCount
          placeholder="用一句话说明这条通知"
        />
      </Form.Item>
      <Form.Item
        label="内容"
        name="body"
        rules={[
          { required: true, message: '请输入内容' },
          { whitespace: true, message: '内容不能只包含空格' },
          { max: 2000, message: '内容不能超过 2000 个字符' },
        ]}
      >
        <Input.TextArea
          allowClear
          maxLength={2000}
          showCount
          rows={3}
          placeholder="说明发生了什么，以及成员需要做什么"
        />
      </Form.Item>
      <div className={styles.optionalLinkRow}>
        <div className={styles.optionalLinkCopy}>
          <Typography.Text strong>点击后前往</Typography.Text>
          <Typography.Text type="secondary">
            引导成员前往相关页面
          </Typography.Text>
        </div>
        {!editor.linkExpanded ? (
          <Button
            type="link"
            size="small"
            icon={<PlusOutlined />}
            aria-label="添加链接"
            onClick={() => editor.setLinkExpanded(true)}
          >
            添加链接
          </Button>
        ) : null}
      </div>
      {editor.linkExpanded ? (
        <Form.Item
          name="url"
          className={styles.linkFormItem}
          extra="支持站内路径（如 /dashboard/…）或完整的 http(s) 链接。"
          rules={[
            { max: 500, message: '链接不能超过 500 个字符' },
            {
              validator: async (_rule, value) => {
                if (!editor.isSupportedDispatchUrl(value)) {
                  throw new Error('请输入站内路径或完整的 http(s) 链接');
                }
              },
            },
          ]}
        >
          <Input
            aria-label="点击后前往（可选）"
            allowClear
            maxLength={500}
            prefix={<LinkOutlined />}
            placeholder="/dashboard/tenant-operations/tasks"
          />
        </Form.Item>
      ) : null}
    </section>
  );
};

export default MessageSection;
