import { useMutation } from '@tanstack/react-query';
import {
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Select,
} from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import React from 'react';
import {
  type AllocationBeneficiary,
  allocationApi,
} from '@/services/manual/allocation';

type ManualAdjustmentValues = {
  beneficiary_user_id: number;
  entry_type: 'manual_increase' | 'manual_decrease';
  amount: string;
  effective_month: Dayjs;
  reason: string;
};

type ManualAdjustmentModalProps = {
  beneficiaries: AllocationBeneficiary[];
  beneficiariesLoading?: boolean;
  onClose: () => void;
  onSuccess: () => void;
  open: boolean;
};

const ManualAdjustmentModal: React.FC<ManualAdjustmentModalProps> = ({
  beneficiaries,
  beneficiariesLoading,
  onClose,
  onSuccess,
  open,
}) => {
  const [form] = Form.useForm<ManualAdjustmentValues>();
  const mutation = useMutation({
    mutationFn: (values: ManualAdjustmentValues) =>
      allocationApi.createManualEntry({
        beneficiary_user_id: values.beneficiary_user_id,
        entry_type: values.entry_type,
        amount: values.amount,
        effective_month: values.effective_month
          .startOf('month')
          .format('YYYY-MM-DD'),
        reason: values.reason,
      }),
    onSuccess: () => {
      message.success('人工收益调整已记入流水');
      form.resetFields();
      onSuccess();
      onClose();
    },
  });

  return (
    <Modal
      title="人工调整收益"
      open={open}
      okText="确认记入流水"
      confirmLoading={mutation.isPending}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          entry_type: 'manual_increase',
          effective_month: dayjs().startOf('month'),
        }}
        onFinish={(values) => mutation.mutate(values)}
      >
        <Form.Item
          label="受益人"
          name="beneficiary_user_id"
          rules={[{ required: true, message: '请选择受益人' }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            loading={beneficiariesLoading}
            options={beneficiaries.map((item) => ({
              value: item.user_id,
              label: item.name,
            }))}
          />
        </Form.Item>
        <Form.Item
          label="调整类型"
          name="entry_type"
          rules={[{ required: true }]}
        >
          <Select
            options={[
              { value: 'manual_increase', label: '人工增加' },
              { value: 'manual_decrease', label: '人工扣减' },
            ]}
          />
        </Form.Item>
        <Form.Item
          label="金额"
          name="amount"
          rules={[{ required: true, message: '请输入调整金额' }]}
        >
          <InputNumber<string>
            stringMode
            min="0.01"
            precision={2}
            prefix="¥"
            suffix="元"
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item
          label="归属月份"
          name="effective_month"
          rules={[{ required: true, message: '请选择归属月份' }]}
        >
          <DatePicker
            picker="month"
            style={{ width: '100%' }}
            disabledDate={(current) => current.isAfter(dayjs().endOf('month'))}
          />
        </Form.Item>
        <Form.Item
          label="原因"
          name="reason"
          rules={[
            { required: true, whitespace: true, message: '请填写调整原因' },
          ]}
          extra="提交后不可编辑；填错时请追加一条反向调整。"
        >
          <Input.TextArea rows={4} maxLength={2000} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ManualAdjustmentModal;
