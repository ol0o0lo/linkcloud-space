import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Input } from 'antd';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { InlineEditableField } from './InlineEditableField';

type HarnessProps = {
  onSave: (value: string) => Promise<void>;
  validate?: (value: string) => string | undefined;
};

function Harness({ onSave, validate }: HarnessProps) {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState('旧值');

  return (
    <InlineEditableField<string, string>
      active={active}
      ariaLabel="编辑测试字段"
      enabled
      fieldKey="test"
      isUnchanged={(draft, current) => draft === current}
      prepareDraft={(current) => current}
      renderDisplay={() => <span>{value}</span>}
      renderEditor={({ draft, saving, setDraft }) => (
        <Input
          autoFocus
          aria-label="测试字段"
          disabled={saving}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      )}
      validate={validate}
      value={value}
      onClose={() => setActive(false)}
      onRequestActivate={() => setActive(true)}
      onSave={async (draft) => {
        await onSave(draft);
        setValue(draft);
      }}
    />
  );
}

function ImmediateSaveHarness({ onSave }: Pick<HarnessProps, 'onSave'>) {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState('旧值');

  return (
    <InlineEditableField<string, string>
      active={active}
      ariaLabel="编辑立即保存字段"
      enabled
      fieldKey="immediate"
      isUnchanged={(draft, current) => draft === current}
      prepareDraft={(current) => current}
      renderDisplay={() => <span>{value}</span>}
      renderEditor={({ draft, save, setDraft }) => (
        <select
          aria-label="立即保存字段"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            save();
          }}
        >
          <option value="旧值">旧值</option>
          <option value="新值">新值</option>
        </select>
      )}
      value={value}
      onClose={() => setActive(false)}
      onRequestActivate={() => setActive(true)}
      onSave={async (draft) => {
        await onSave(draft);
        setValue(draft);
      }}
    />
  );
}

function MultilineHarness({ onSave }: Pick<HarnessProps, 'onSave'>) {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState('原备注');

  return (
    <InlineEditableField<string, string>
      active={active}
      ariaLabel="编辑备注"
      enabled
      fieldKey="notes"
      isUnchanged={(draft, current) => draft === current}
      prepareDraft={(current) => current}
      renderDisplay={() => <span>{value}</span>}
      renderEditor={({ draft, saving, setDraft }) => (
        <Input.TextArea
          autoFocus
          aria-label="备注"
          disabled={saving}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      )}
      value={value}
      onClose={() => setActive(false)}
      onRequestActivate={() => setActive(true)}
      onSave={async (draft) => {
        await onSave(draft);
        setValue(draft);
      }}
    />
  );
}

describe('InlineEditableField', () => {
  it('only enters edit mode from the edit icon', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<Harness onSave={onSave} />);

    fireEvent.click(screen.getByText('旧值'));
    expect(screen.queryByLabelText('测试字段')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '编辑测试字段' }));
    expect(screen.getByLabelText('测试字段')).toBeInTheDocument();
  });

  it('enters edit mode from the displayed value and saves with Enter', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<Harness onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: '编辑测试字段' }));
    const input = screen.getByLabelText('测试字段');
    expect(
      screen.queryByRole('button', { name: '保存编辑测试字段' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '取消编辑测试字段' }),
    ).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: '新值' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('新值'));
    expect(await screen.findByText('新值')).toBeInTheDocument();
  });

  it('cancels with Escape without submitting the draft', () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<Harness onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: '编辑测试字段' }));
    const input = screen.getByLabelText('测试字段');
    fireEvent.change(input, { target: { value: '不保存' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('旧值')).toBeInTheDocument();
  });

  it('saves when the user clicks outside the editor', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<Harness onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: '编辑测试字段' }));
    fireEvent.change(screen.getByLabelText('测试字段'), {
      target: { value: '外部保存' },
    });
    fireEvent.pointerDown(document.body);

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('外部保存'));
  });

  it('saves when the editor loses focus', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<Harness onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: '编辑测试字段' }));
    const input = screen.getByLabelText('测试字段');
    fireEvent.change(input, { target: { value: '失焦保存' } });
    fireEvent.blur(input, { relatedTarget: document.body });

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('失焦保存'));
  });

  it('lets selection editors save immediately after changing the draft', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ImmediateSaveHarness onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: '编辑立即保存字段' }));
    fireEvent.change(screen.getByLabelText('立即保存字段'), {
      target: { value: '新值' },
    });

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('新值'));
    expect(await screen.findByText('新值')).toBeInTheDocument();
  });

  it('keeps Enter for multiline input and saves with Ctrl+Enter', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<MultilineHarness onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: '编辑备注' }));
    const textarea = screen.getByLabelText('备注');
    fireEvent.change(textarea, { target: { value: '第一行\n第二行' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText('备注')).toBeInTheDocument();

    fireEvent.keyDown(textarea, { ctrlKey: true, key: 'Enter' });
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('第一行\n第二行'));
  });

  it('keeps the draft visible when validation or saving fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('服务端保存失败'));
    render(
      <Harness
        onSave={onSave}
        validate={(value) => (value.trim() ? undefined : '请输入内容')}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '编辑测试字段' }));
    const input = screen.getByLabelText('测试字段');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByText('请输入内容')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '保留草稿' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByText('服务端保存失败')).toBeInTheDocument();
    expect(screen.getByLabelText('测试字段')).toHaveValue('保留草稿');
  });
});
