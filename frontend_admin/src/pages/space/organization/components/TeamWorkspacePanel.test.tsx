import { fireEvent, render, screen } from '@testing-library/react';
import { Form } from 'antd';
import { describe, expect, it, vi } from 'vitest';
import { BusinessHoursField, TeamProfileDetails } from './TeamWorkspacePanel';

vi.mock('@ant-design/pro-components', () => ({ ProTable: () => null }));

describe('BusinessHoursField', () => {
  it('支持常用营业时间建议和自由输入', async () => {
    render(
      <Form>
        <BusinessHoursField />
      </Form>,
    );
    const input = screen.getByLabelText('营业时间');
    fireEvent.change(input, { target: { value: '24' } });

    expect(input).toHaveValue('24');
    expect(
      await screen.findByRole('option', { name: '24小时营业' }),
    ).toBeInTheDocument();
  });
});

describe('TeamProfileDetails', () => {
  const team = {
    name: '人力行政部',
    phone: '',
    wechat: 'LAN-people',
    address: '上海市浦东新区云桥路 88 号 6 楼',
    business_hours: '工作日 09:00-18:00',
    created_at: '2026-08-24T00:02:00+08:00',
    updated_at: '2026-08-25T08:30:00+08:00',
  };

  it('默认以只读详情展示，并由编辑按钮进入编辑流程', () => {
    const onEdit = vi.fn();

    render(<TeamProfileDetails team={team} canEdit onEdit={onEdit} />);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('人力行政部')).toBeInTheDocument();
    expect(screen.getByText('未填写')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /编辑/ }));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('无编辑权限时不显示编辑入口', () => {
    render(<TeamProfileDetails team={team} canEdit={false} onEdit={vi.fn()} />);

    expect(
      screen.queryByRole('button', { name: /编辑/ }),
    ).not.toBeInTheDocument();
  });
});
