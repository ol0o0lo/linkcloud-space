import type { SelectProps } from 'antd';
import { Select, Space, Tag, Typography } from 'antd';
import { useMemo } from 'react';

export const PROPERTY_TAG_TOKEN_SEPARATORS = [',', '，', ';', '；', '、'];

const EMPTY_TAGS: readonly string[] = [];

export function normalizePropertyTags(
  values: readonly unknown[] | null | undefined,
): string[] {
  const normalizedTags: string[] = [];
  const seen = new Set<string>();

  for (const value of values ?? EMPTY_TAGS) {
    if (typeof value !== 'string') continue;

    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized || seen.has(normalized)) continue;

    seen.add(normalized);
    normalizedTags.push(normalized);
  }

  return normalizedTags;
}

export function getInheritedPropertyTags(
  value: readonly unknown[] | null | undefined,
  inheritedTags: readonly unknown[] | null | undefined,
): string[] {
  const ownTags = new Set(normalizePropertyTags(value));
  return normalizePropertyTags(inheritedTags).filter(
    (tag) => !ownTags.has(tag),
  );
}

export type PropertyTagSelectProps = Omit<
  SelectProps<string[]>,
  | 'allowClear'
  | 'children'
  | 'defaultValue'
  | 'labelInValue'
  | 'loading'
  | 'mode'
  | 'onChange'
  | 'options'
  | 'tokenSeparators'
  | 'value'
> & {
  value?: string[];
  onChange?: (value: string[]) => void;
  suggestions?: readonly string[];
  inheritedTags?: readonly string[];
  suggestionsLoading?: boolean;
  suggestionsError?: boolean;
};

export function PropertyTagSelect({
  value = [],
  onChange,
  suggestions = EMPTY_TAGS,
  inheritedTags = EMPTY_TAGS,
  suggestionsLoading = false,
  suggestionsError = false,
  disabled,
  placeholder = '选择或输入标签',
  style,
  ...selectProps
}: PropertyTagSelectProps) {
  const normalizedValue = useMemo(() => normalizePropertyTags(value), [value]);
  const normalizedSuggestions = useMemo(
    () => normalizePropertyTags(suggestions),
    [suggestions],
  );
  const visibleInheritedTags = useMemo(
    () => getInheritedPropertyTags(normalizedValue, inheritedTags),
    [inheritedTags, normalizedValue],
  );
  const selectedTags = useMemo(
    () => new Set(normalizedValue),
    [normalizedValue],
  );

  const emitChange = (nextValue: readonly unknown[]) => {
    onChange?.(normalizePropertyTags(nextValue));
  };

  const toggleSuggestion = (tag: string, checked: boolean) => {
    emitChange(
      checked
        ? [...normalizedValue, tag]
        : normalizedValue.filter((item) => item !== tag),
    );
  };

  return (
    <Space orientation="vertical" size={4} style={{ width: '100%' }}>
      <Select<string[]>
        {...selectProps}
        allowClear
        disabled={disabled}
        loading={suggestionsLoading}
        mode="tags"
        options={normalizedSuggestions.map((tag) => ({
          label: tag,
          value: tag,
        }))}
        placeholder={placeholder}
        style={{ width: '100%', ...style }}
        tokenSeparators={PROPERTY_TAG_TOKEN_SEPARATORS}
        value={normalizedValue}
        onChange={emitChange}
      />

      <Typography.Text type="secondary">
        选择常用标签，或输入后按回车；逗号可批量添加。
      </Typography.Text>

      {suggestionsLoading ? (
        <Typography.Text type="secondary">常用标签加载中…</Typography.Text>
      ) : null}
      {suggestionsError ? (
        <Typography.Text type="secondary">
          常用标签暂时不可用，仍可手动输入。
        </Typography.Text>
      ) : null}

      {normalizedSuggestions.length ? (
        <fieldset
          aria-label="常用标签"
          style={{ border: 0, margin: 0, minWidth: 0, padding: 0 }}
        >
          <Typography.Text type="secondary">常用标签：</Typography.Text>
          {normalizedSuggestions.map((tag) => (
            <Tag.CheckableTag
              key={tag}
              checked={selectedTags.has(tag)}
              disabled={disabled}
              onChange={(checked) => toggleSuggestion(tag, checked)}
            >
              {tag}
            </Tag.CheckableTag>
          ))}
        </fieldset>
      ) : null}

      {visibleInheritedTags.length ? (
        <section aria-label="继承标签">
          <Typography.Text type="secondary">将从当前楼栋继承：</Typography.Text>
          <Space size={[4, 4]} wrap>
            {visibleInheritedTags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Space>
        </section>
      ) : null}
    </Space>
  );
}
