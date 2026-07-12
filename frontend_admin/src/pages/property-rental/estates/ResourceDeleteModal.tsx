import { Button, Modal, message, Spin } from 'antd';
import React, { useEffect, useState } from 'react';
import { getResourceInUseData } from '@/services/manual/apiError';
import { type DeleteCheckOut, houseApi } from '@/services/manual/house';

export type DeleteTarget = {
  type: 'estate' | 'building';
  id: number;
  label: string;
};

type DeletePhase = 'checking' | 'confirm' | 'blocked';

type ResourceDeleteModalProps = {
  open: boolean;
  target: DeleteTarget | null;
  onClose: () => void;
  onDeleted: () => void | Promise<void>;
};

function resourceHref(resource: API.RelatedResourceOut) {
  const params = new URLSearchParams();
  Object.entries(resource.target.query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) params.set(key, String(value));
  });
  const path = resource.target.path.startsWith('/dashboard/')
    ? resource.target.path
    : `/dashboard${resource.target.path}`;
  return `${path}${params.size ? `?${params.toString()}` : ''}`;
}

function ResourceList({ check }: { check: DeleteCheckOut | null }) {
  return (
    <>
      <p>当前记录存在关联资源，不能删除</p>
      {check?.resources.map((resource) => (
        <div key={`${resource.type}-${resource.target.path}`}>
          <div>
            {resource.label}（{resource.count}）
          </div>
          {resource.items.map((item) => (
            <div key={item.id}>{item.label}</div>
          ))}
          <a href={resourceHref(resource)}>查看全部{resource.label}</a>
        </div>
      ))}
    </>
  );
}

export function ResourceDeleteModal({
  open,
  target,
  onClose,
  onDeleted,
}: ResourceDeleteModalProps) {
  const [phase, setPhase] = useState<DeletePhase>('checking');
  const [check, setCheck] = useState<DeleteCheckOut | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open || !target) return;
    let active = true;
    setPhase('checking');
    setCheck(null);
    const fetchCheck =
      target.type === 'estate'
        ? houseApi.checkEstateDelete
        : houseApi.checkBuildingDelete;
    fetchCheck(target.id)
      .then((result) => {
        if (!active) return;
        setCheck(result);
        setPhase(result.can_delete ? 'confirm' : 'blocked');
      })
      .catch(() => {
        if (!active) return;
        message.error('删除检查失败，请稍后重试');
        onClose();
      });
    return () => {
      active = false;
    };
  }, [onClose, open, target]);

  const confirmDelete = async () => {
    if (!target) return;
    setDeleting(true);
    const removeTarget =
      target.type === 'estate'
        ? houseApi.deleteEstate
        : houseApi.deleteBuilding;
    try {
      await removeTarget(target.id);
      await onDeleted();
      onClose();
    } catch (error) {
      const conflict = getResourceInUseData(error);
      if (conflict) {
        setCheck(conflict);
        setPhase('blocked');
        return;
      }
      message.error('删除失败，请稍后重试');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="删除确认"
      destroyOnHidden
      onCancel={onClose}
      footer={
        phase === 'confirm'
          ? [
              <Button key="cancel" onClick={onClose}>
                取消
              </Button>,
              <Button
                key="delete"
                danger
                type="primary"
                loading={deleting}
                onClick={confirmDelete}
              >
                确认删除
              </Button>,
            ]
          : [
              <Button key="close" onClick={onClose}>
                关闭
              </Button>,
            ]
      }
    >
      {phase === 'checking' ? <Spin tip="正在检查关联资源" /> : null}
      {phase === 'confirm' && target ? <p>确认删除“{target.label}”？</p> : null}
      {phase === 'blocked' ? <ResourceList check={check} /> : null}
    </Modal>
  );
}
