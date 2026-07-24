import { SendOutlined } from '@ant-design/icons';
import { Form, Modal, Space, Typography } from 'antd';
import React from 'react';
import type { NotificationDispatchManagementContext } from '@/services/manual/notificationDispatches';
import MessageSection from './editor/MessageSection';
import RecipientSection from './editor/RecipientSection';
import type { DispatchSource } from './editor/types';
import { useNotificationDispatchEditor } from './editor/useNotificationDispatchEditor';
import { useStyles } from './styles';

export type { DispatchScope } from './editor/types';

type NotificationDispatchCreateModalProps = {
  open: boolean;
  isTenantMode: boolean;
  managementContext: NotificationDispatchManagementContext;
  currentOrganization?: { id: number; name: string };
  source?: DispatchSource;
  onCancel: () => void;
  onSuccess: () => void;
};

const NotificationDispatchCreateModal: React.FC<
  NotificationDispatchCreateModalProps
> = ({
  open,
  isTenantMode,
  managementContext,
  currentOrganization,
  source,
  onCancel,
  onSuccess,
}) => {
  const { styles } = useStyles();
  const editor = useNotificationDispatchEditor({
    open,
    isTenantMode,
    managementContext,
    currentOrganization,
    source,
    onCancel,
    onSuccess,
  });

  return (
    <Modal
      className={styles.createModal}
      width={720}
      centered
      title={
        <div className={styles.createTitle}>
          <span className={styles.createTitleIcon}>
            <SendOutlined aria-hidden />
          </span>
          <div className={styles.createTitleCopy}>
            <Typography.Text strong className={styles.createTitleText}>
              {isTenantMode ? '发送空间通知' : '发送平台通知'}
            </Typography.Text>
            <Typography.Text type="secondary" className={styles.createSubtitle}>
              {isTenantMode
                ? '重要消息将通过通知中心送达成员'
                : '向平台用户发送重要通知'}
            </Typography.Text>
          </div>
        </div>
      }
      open={open}
      okText="发送通知"
      cancelText="取消"
      confirmLoading={editor.isSubmitting}
      okButtonProps={{
        icon: <SendOutlined aria-hidden />,
        className: styles.sendButton,
      }}
      cancelButtonProps={{ disabled: editor.isSubmitting }}
      closable={!editor.isSubmitting}
      keyboard={!editor.isSubmitting}
      mask={{ closable: !editor.isSubmitting }}
      onCancel={editor.close}
      onOk={() => void editor.submit()}
      footer={(_originNode, { OkBtn, CancelBtn }) => (
        <div className={styles.createFooter}>
          <Space size={8}>
            <CancelBtn />
            <OkBtn />
          </Space>
        </div>
      )}
    >
      <Form form={editor.form} layout="vertical" className={styles.createForm}>
        <RecipientSection editor={editor} />
        <MessageSection editor={editor} />
      </Form>
    </Modal>
  );
};

export default NotificationDispatchCreateModal;
