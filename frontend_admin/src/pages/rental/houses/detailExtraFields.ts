export type InlineExtraDraft =
  | { kind: 'array'; value: string[] }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'number'; value: number | null }
  | { kind: 'object'; value: string }
  | { kind: 'text'; value: string };

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function prepareInlineExtraDraft(value: unknown): InlineExtraDraft {
  if (Array.isArray(value)) {
    return { kind: 'array', value: value.map((item) => String(item)) };
  }
  if (isPlainObject(value)) {
    return { kind: 'object', value: JSON.stringify(value, null, 2) };
  }
  if (typeof value === 'boolean') return { kind: 'boolean', value };
  if (typeof value === 'number') return { kind: 'number', value };
  return { kind: 'text', value: value == null ? '' : String(value) };
}

export function parseInlineExtraDraft(
  draft: InlineExtraDraft,
  originalValue: unknown,
): unknown {
  if (draft.kind === 'object') return JSON.parse(draft.value);
  if (draft.kind === 'array') {
    const originalItems = Array.isArray(originalValue) ? originalValue : [];
    const originalsByText = new Map(
      originalItems.map((item) => [String(item), item]),
    );
    return draft.value.map((item) =>
      originalsByText.has(item) ? originalsByText.get(item) : item,
    );
  }
  if (draft.kind === 'text' && draft.value === '' && originalValue == null) {
    return originalValue;
  }
  return draft.value;
}

export function buildInlineExtraPatch(
  extra: Record<string, unknown>,
  key: string,
  draft: InlineExtraDraft,
) {
  return {
    ...extra,
    [key]: parseInlineExtraDraft(draft, extra[key]),
  };
}

export function validateInlineExtraDraft(draft: InlineExtraDraft) {
  if (draft.kind !== 'object') return undefined;
  try {
    const parsed = JSON.parse(draft.value);
    return isPlainObject(parsed) ? undefined : '请输入 JSON 对象';
  } catch {
    return 'JSON 格式不正确';
  }
}

export function inlineExtraDraftUnchanged(
  draft: InlineExtraDraft,
  originalValue: unknown,
) {
  return (
    JSON.stringify(parseInlineExtraDraft(draft, originalValue)) ===
    JSON.stringify(originalValue)
  );
}
