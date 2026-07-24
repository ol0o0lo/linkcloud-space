import {
  ApartmentOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Form, Radio, Select, Typography } from 'antd';
import { useStyles } from '../styles';
import type { DispatchScope } from './types';
import type { NotificationDispatchEditor } from './useNotificationDispatchEditor';

const SCOPE_ICONS: Record<DispatchScope, React.ReactNode> = {
  platform: <GlobalOutlined aria-hidden />,
  organization: <ApartmentOutlined aria-hidden />,
  teams: <ApartmentOutlined aria-hidden />,
  users: <UserOutlined aria-hidden />,
};

type RecipientSectionProps = {
  editor: NotificationDispatchEditor;
};

const RecipientSection = ({ editor }: RecipientSectionProps) => {
  const { styles } = useStyles();
  const targetNotFoundContent = editor.targetQuery.isError ? (
    <div className={styles.targetLoadError}>
      <Typography.Text type="danger">接收目标加载失败</Typography.Text>
      <Button
        type="link"
        size="small"
        aria-label="重新加载接收目标"
        onClick={() => void editor.targetQuery.refetch()}
      >
        重试
      </Button>
    </div>
  ) : editor.targetQuery.isFetching ? (
    '正在搜索…'
  ) : (
    '没有匹配项'
  );

  return (
    <section
      className={styles.createSection}
      aria-labelledby="recipient-heading"
    >
      <Typography.Title
        level={5}
        id="recipient-heading"
        className={styles.sectionTitle}
      >
        选择接收人
      </Typography.Title>
      <Form.Item
        name="scope"
        className={styles.scopeFormItem}
        rules={[{ required: true, message: '请选择发送范围' }]}
      >
        <Radio.Group
          aria-label="选择接收人"
          buttonStyle="solid"
          className={styles.scopeGroup}
          onChange={editor.onScopeChange}
        >
          {editor.scopeOptions.map((option) => (
            <Radio.Button
              key={option.value}
              value={option.value}
              aria-label={option.label}
              className={styles.scopeOption}
            >
              <span className={styles.scopeOptionContent}>
                <span className={styles.scopeOptionIcon}>
                  {SCOPE_ICONS[option.value]}
                </span>
                <span className={styles.scopeOptionCopy}>
                  <span className={styles.scopeOptionLabel}>
                    {option.label}
                  </span>
                </span>
              </span>
            </Radio.Button>
          ))}
        </Radio.Group>
      </Form.Item>
      <div className={styles.recipientSummary}>
        <InfoCircleOutlined aria-hidden />
        <div>
          <Typography.Text>{editor.recipientSummary.hint}</Typography.Text>
          {editor.recipientSummary.status ? (
            <Typography.Text
              type="secondary"
              className={styles.recipientStatus}
            >
              {editor.recipientSummary.status}
            </Typography.Text>
          ) : null}
        </div>
      </div>
      {editor.recipientSummary.needsTargetSelection ? (
        <Form.Item
          key={editor.scopeValue}
          label={editor.targetLabel}
          name="targets"
          dependencies={['scope']}
          rules={[
            {
              validator: async (_rule, value) => {
                if (!value?.length)
                  throw new Error(`请选择至少一个${editor.targetLabel}`);
              },
            },
          ]}
        >
          <Select
            mode="multiple"
            labelInValue
            allowClear
            showSearch={{
              filterOption: false,
              onSearch: editor.setTargetKeyword,
            }}
            options={editor.targetOptions}
            loading={editor.targetQuery.isFetching}
            placeholder={editor.targetPlaceholder}
            maxTagCount="responsive"
            notFoundContent={targetNotFoundContent}
          />
        </Form.Item>
      ) : null}
    </section>
  );
};

export default RecipientSection;
