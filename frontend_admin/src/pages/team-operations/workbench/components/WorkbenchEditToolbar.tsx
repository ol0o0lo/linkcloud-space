import { Button, Modal, Space, Typography } from 'antd';
import { useStyles } from '../styles';

type WorkbenchEditToolbarProps = {
  viewLabel: string;
  isDirty: boolean;
  isSaving: boolean;
  canSave: boolean;
  onRestore: () => void;
  onCancel: () => void;
  onSave: () => void;
};

export function WorkbenchEditToolbar({
  viewLabel,
  isDirty,
  isSaving,
  canSave,
  onRestore,
  onCancel,
  onSave,
}: WorkbenchEditToolbarProps) {
  const { styles } = useStyles();
  const cancel = () => {
    if (!isDirty) {
      onCancel();
      return;
    }
    Modal.confirm({
      title: '放弃未保存的工作台调整？',
      content: '本次排序、显隐和宽度修改不会保存。',
      okText: '放弃修改',
      cancelText: '继续编辑',
      onOk: onCancel,
    });
  };

  return (
    <div className={styles.editToolbar}>
      <div>
        <span className={styles.editToolbarEyebrow}>LAYOUT EDITOR</span>
        <div className={styles.editToolbarTitle}>
          <Typography.Text strong>{`正在自定义${viewLabel}`}</Typography.Text>
          <Typography.Text
            className={styles.editToolbarStatus}
            aria-live="polite"
          >
            {isSaving ? '保存中' : isDirty ? '尚未保存' : '没有未保存修改'}
          </Typography.Text>
        </div>
      </div>
      <Space wrap className={styles.editToolbarActions}>
        <Button danger onClick={onRestore}>
          恢复默认
        </Button>
        <Button onClick={cancel}>取消</Button>
        <Button
          type="primary"
          loading={isSaving}
          disabled={!canSave}
          onClick={onSave}
        >
          保存布局
        </Button>
      </Space>
    </div>
  );
}
