import {
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Segmented,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';

export type DealSigningLeaseTerm = '6' | '12' | '24' | 'custom';
export type DealSigningDepositMode =
  | 'none'
  | 'one_month'
  | 'two_months'
  | 'three_months'
  | 'custom';
export type DealSigningAutoFilledField =
  | 'deposit'
  | 'end_date'
  | 'monthly_rent';

type DealSigningLeaseFieldsProps = {
  autoFilledFields: DealSigningAutoFilledField[];
  depositMode: DealSigningDepositMode;
  disabled?: boolean;
  leaseTerm: DealSigningLeaseTerm;
  onDepositModeChange: (value: string | number) => void;
  onLeaseTermChange: (value: string | number) => void;
};

const useStyles = createStyles(({ css, token }) => ({
  quickControl: css`
    margin-bottom: 16px;
  `,
  quickControlLabel: css`
    display: block;
    margin-bottom: 8px;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    font-weight: 600;
  `,
  fullWidth: css`
    width: 100%;
  `,
  depositPreset: css`
    margin-top: -12px;
    margin-bottom: 12px;
  `,
  paymentHint: css`
    display: block;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
  `,
  autoFill: css`
    .ant-input,
    .ant-input-number {
      transition:
        background-color 160ms ease,
        border-color 160ms ease,
        box-shadow 160ms ease;
    }

    &[data-highlighted='true'] .ant-input,
    &[data-highlighted='true'] .ant-input-number {
      border-color: ${token.colorPrimaryBorder};
      background: ${token.colorPrimaryBg};
      box-shadow: 0 0 0 2px ${token.colorPrimaryBgHover};
    }

    @media (prefers-reduced-motion: reduce) {
      .ant-input,
      .ant-input-number {
        transition: none;
      }
    }
  `,
}));

const DealSigningLeaseFields: React.FC<DealSigningLeaseFieldsProps> = ({
  autoFilledFields,
  depositMode,
  disabled,
  leaseTerm,
  onDepositModeChange,
  onLeaseTermChange,
}) => {
  const { styles } = useStyles();
  const highlighted = (field: DealSigningAutoFilledField) =>
    autoFilledFields.includes(field);

  return (
    <>
      <div className={styles.quickControl}>
        <Typography.Text className={styles.quickControlLabel}>
          租期快捷选择
        </Typography.Text>
        <Segmented
          block
          disabled={disabled}
          value={leaseTerm}
          options={[
            { label: '半年', value: '6' },
            { label: '1 年', value: '12' },
            { label: '2 年', value: '24' },
            { label: '自定义', value: 'custom' },
          ]}
          onChange={onLeaseTermChange}
        />
      </div>
      <Form.Item name="payment_day" hidden>
        <InputNumber />
      </Form.Item>
      <Row gutter={[16, 0]}>
        <Col xs={24} md={12}>
          <Form.Item
            label="起租日期"
            name="start_date"
            rules={[{ required: true, message: '请选择起租日期' }]}
          >
            <Input type="date" disabled={disabled} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <div
            className={styles.autoFill}
            data-highlighted={highlighted('end_date')}
          >
            <Form.Item
              label="到期日期"
              name="end_date"
              rules={[{ required: true, message: '请选择到期日期' }]}
            >
              <Input type="date" disabled={disabled} />
            </Form.Item>
          </div>
        </Col>
        <Col xs={24} md={12}>
          <div
            className={styles.autoFill}
            data-highlighted={highlighted('monthly_rent')}
          >
            <Form.Item
              label="月租"
              name="monthly_rent"
              rules={[{ required: true, message: '请输入月租' }]}
            >
              <InputNumber<string>
                stringMode
                min="0"
                precision={2}
                controls={false}
                disabled={disabled}
                prefix="¥"
                suffix="元/月"
                className={styles.fullWidth}
              />
            </Form.Item>
          </div>
        </Col>
        <Col xs={24} md={12}>
          <div
            className={styles.autoFill}
            data-highlighted={highlighted('deposit')}
          >
            <Form.Item label="押金" name="deposit">
              <InputNumber<string>
                stringMode
                min="0"
                precision={2}
                controls={false}
                disabled={disabled}
                prefix="¥"
                suffix="元"
                className={styles.fullWidth}
              />
            </Form.Item>
            <Segmented
              block
              size="small"
              disabled={disabled}
              value={depositMode}
              options={[
                { label: '无押金', value: 'none' },
                { label: '押 1 月', value: 'one_month' },
                { label: '押 2 月', value: 'two_months' },
                { label: '押 3 月', value: 'three_months' },
                { label: '自定义', value: 'custom' },
              ]}
              onChange={onDepositModeChange}
              className={styles.depositPreset}
            />
          </div>
        </Col>
      </Row>
      <Typography.Text className={styles.paymentHint}>
        每月付款日自动采用起租日期，无需单独填写。
      </Typography.Text>
    </>
  );
};

export default DealSigningLeaseFields;
