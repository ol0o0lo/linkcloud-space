import { describe, expect, it } from 'vitest';
import {
  buildInlineExtraPatch,
  inlineExtraDraftUnchanged,
  prepareInlineExtraDraft,
  validateInlineExtraDraft,
} from './detailExtraFields';

describe('house detail extra fields', () => {
  const extra = {
    门锁品牌: '凯迪仕',
    钥匙数量: 3,
    需要预约: true,
    配套: ['空调', 2],
    验房信息: { 水表读数: 12, 正常: true },
  };

  it('preserves sibling fields and original scalar types', () => {
    expect(
      buildInlineExtraPatch(extra, '门锁品牌', {
        kind: 'text',
        value: '德施曼',
      }),
    ).toEqual({ ...extra, 门锁品牌: '德施曼' });
    expect(
      buildInlineExtraPatch(extra, '钥匙数量', { kind: 'number', value: 5 }),
    ).toEqual({ ...extra, 钥匙数量: 5 });
    expect(
      buildInlineExtraPatch(extra, '需要预约', {
        kind: 'boolean',
        value: false,
      }),
    ).toEqual({ ...extra, 需要预约: false });
  });

  it('parses object drafts and rejects invalid JSON values', () => {
    const draft = { kind: 'object' as const, value: '{"水表读数":18}' };
    expect(buildInlineExtraPatch(extra, '验房信息', draft)).toEqual({
      ...extra,
      验房信息: { 水表读数: 18 },
    });
    expect(validateInlineExtraDraft(draft)).toBeUndefined();
    expect(
      validateInlineExtraDraft({ kind: 'object', value: '{' }),
    ).toBe('JSON 格式不正确');
    expect(
      validateInlineExtraDraft({ kind: 'object', value: '[1,2]' }),
    ).toBe('请输入 JSON 对象');
  });

  it('preserves original array item types while appending new tags', () => {
    expect(
      buildInlineExtraPatch(extra, '配套', {
        kind: 'array',
        value: ['空调', '2', '洗衣机'],
      }),
    ).toEqual({ ...extra, 配套: ['空调', 2, '洗衣机'] });
  });

  it('prepares drafts by type and compares parsed values', () => {
    expect(prepareInlineExtraDraft(extra.验房信息)).toEqual({
      kind: 'object',
      value: JSON.stringify(extra.验房信息, null, 2),
    });
    expect(
      inlineExtraDraftUnchanged(
        { kind: 'array', value: ['空调', '2'] },
        extra.配套,
      ),
    ).toBe(true);
  });
});
