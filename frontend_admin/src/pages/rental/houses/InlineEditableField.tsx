import { EditOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

const INLINE_EDIT_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';

type InlineEditorRenderProps<TDraft> = {
  draft: TDraft;
  getPopupContainer: (triggerNode: HTMLElement) => HTMLElement;
  save: () => void;
  saving: boolean;
  setDraft: (value: TDraft) => void;
};

export type InlineEditCloseReason = 'cancelled' | 'saved' | 'unchanged';

type InlineEditableFieldProps<TValue, TDraft> = {
  active: boolean;
  activateOnContainerClick?: boolean;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  enabled: boolean;
  fieldKey: string;
  isUnchanged?: (draft: TDraft, value: TValue) => boolean;
  onClose: (reason: InlineEditCloseReason) => void;
  onRequestActivate: (fieldKey: string) => void;
  onSave: (draft: TDraft) => Promise<void>;
  onSaveFailure?: () => void;
  onSavingChange?: (saving: boolean) => void;
  prepareDraft: (value: TValue) => TDraft;
  renderDisplay: () => ReactNode;
  renderEditor: (props: InlineEditorRenderProps<TDraft>) => ReactNode;
  validate?: (draft: TDraft) => string | undefined;
  value: TValue;
};

const useStyles = createStyles(({ css, token }) => ({
  root: css`
    position: relative;
    min-width: 0;
    border-radius: ${token.borderRadiusSM}px;
    outline: none;

    &[data-inline-enabled='true'] {
      padding-inline-end: 30px;
    }

    &[data-inline-clickable='true'] {
      cursor: text;
    }

    &[data-inline-enabled='true']:hover .inline-edit-action,
    &[data-inline-enabled='true']:focus-visible .inline-edit-action,
    &[data-inline-enabled='true']:focus-within .inline-edit-action {
      opacity: 1;
      pointer-events: auto;
    }

    &[data-inline-enabled='true']:focus-visible {
      box-shadow: 0 0 0 2px ${token.colorPrimaryBorder};
    }
  `,
  display: css`
    min-width: 0;
  `,
  editButton: css`
    position: absolute;
    top: 50%;
    inset-inline-end: 0;
    z-index: 1;
    opacity: 0;
    pointer-events: none;
    transform: translateY(-50%);
    transition:
      opacity ${token.motionDurationFast},
      color ${token.motionDurationFast},
      background ${token.motionDurationFast};
  `,
  editor: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
    width: 100%;
  `,
  editorControl: css`
    min-width: 0;
  `,
  error: css`
    margin: 0;
    color: ${token.colorError};
    font-size: ${token.fontSizeSM}px;
    line-height: 1.4;
  `,
}));

function supportsInlineEditing() {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia(INLINE_EDIT_MEDIA_QUERY).matches;
}

export function useInlineEditingSupported() {
  const [supported, setSupported] = useState(supportsInlineEditing);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mediaQuery = window.matchMedia(INLINE_EDIT_MEDIA_QUERY);
    const handleChange = () => setSupported(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener?.('change', handleChange);
    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, []);

  return supported;
}

export function InlineEditableField<TValue, TDraft>({
  active,
  activateOnContainerClick = false,
  ariaLabel,
  className,
  disabled = false,
  enabled,
  fieldKey,
  isUnchanged,
  onClose,
  onRequestActivate,
  onSave,
  onSaveFailure,
  onSavingChange,
  prepareDraft,
  renderDisplay,
  renderEditor,
  validate,
  value,
}: InlineEditableFieldProps<TValue, TDraft>) {
  const { styles, cx } = useStyles();
  const rootRef = useRef<HTMLDivElement>(null);
  const inactiveHeightRef = useRef<number | undefined>(undefined);
  const previousActiveRef = useRef(false);
  const savingRef = useRef(false);
  const errorId = useId();
  const [draft, setDraftState] = useState<TDraft>(() => prepareDraft(value));
  const draftRef = useRef(draft);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const available = enabled && !disabled;

  const setDraft = useCallback((next: TDraft) => {
    draftRef.current = next;
    setDraftState(next);
    setError('');
  }, []);

  useEffect(() => {
    if (active && !previousActiveRef.current) {
      const nextDraft = prepareDraft(value);
      draftRef.current = nextDraft;
      setDraftState(nextDraft);
      setError('');
    }
    previousActiveRef.current = active;
  }, [active, prepareDraft, value]);

  useLayoutEffect(() => {
    if (!active && rootRef.current) {
      inactiveHeightRef.current =
        rootRef.current.getBoundingClientRect().height;
    }
  }, [active, value]);

  const finishSaving = useCallback(
    (nextSaving: boolean) => {
      savingRef.current = nextSaving;
      setSaving(nextSaving);
      onSavingChange?.(nextSaving);
    },
    [onSavingChange],
  );

  const commitDraft = useCallback(async () => {
    if (!active || savingRef.current) return;
    const nextDraft = draftRef.current;
    const validationError = validate?.(nextDraft);
    if (validationError) {
      setError(validationError);
      onSaveFailure?.();
      return;
    }
    if (isUnchanged?.(nextDraft, value)) {
      onClose('unchanged');
      return;
    }

    finishSaving(true);
    setError('');
    try {
      await onSave(nextDraft);
      onClose('saved');
    } catch (saveError) {
      const nextError =
        saveError instanceof Error && saveError.message
          ? saveError.message
          : '保存失败，请稍后重试';
      setError(nextError);
      onSaveFailure?.();
    } finally {
      finishSaving(false);
    }
  }, [
    active,
    finishSaving,
    isUnchanged,
    onClose,
    onSave,
    onSaveFailure,
    validate,
    value,
  ]);

  const cancelEditing = useCallback(() => {
    if (savingRef.current) return;
    setError('');
    onClose('cancelled');
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      void commitDraft();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [active, commitDraft]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!active) {
      if (available && activateOnContainerClick && event.key === 'Enter') {
        event.preventDefault();
        onRequestActivate(fieldKey);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditing();
      return;
    }
    if (event.key === 'Enter' && target.closest('textarea')) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      void commitDraft();
      return;
    }
    if (event.key !== 'Enter' || target.closest('button')) return;
    if (target.closest('.ant-select-open')) return;
    event.preventDefault();
    void commitDraft();
  };

  const handleContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!available || active || !activateOnContainerClick) return;
    const target = event.target as HTMLElement;
    if (target.closest('a, button, input, textarea, [role="combobox"]')) return;
    onRequestActivate(fieldKey);
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!active || savingRef.current) return;
    if ((event.target as HTMLElement).closest('.ant-select')) return;
    const nextFocused = event.relatedTarget as Node | null;
    if (nextFocused && rootRef.current?.contains(nextFocused)) return;
    void commitDraft();
  };

  const getPopupContainer = (triggerNode: HTMLElement) =>
    rootRef.current || triggerNode.parentElement || document.body;

  return (
    // biome-ignore lint/a11y/useSemanticElements: the wrapper contains nested inputs and action buttons, so replacing it with a fieldset or button would break the existing detail-grid semantics.
    <div
      aria-describedby={error ? errorId : undefined}
      aria-label={available || active ? ariaLabel : undefined}
      className={cx(styles.root, className)}
      data-inline-active={active}
      data-inline-clickable={available && activateOnContainerClick}
      data-inline-enabled={enabled}
      data-inline-field-key={fieldKey}
      ref={rootRef}
      role="group"
      style={{
        minHeight: active ? inactiveHeightRef.current : undefined,
      }}
      tabIndex={
        activateOnContainerClick && available && !active ? 0 : undefined
      }
      onBlur={handleBlur}
      onClick={handleContainerClick}
      onKeyDown={handleKeyDown}
    >
      {active ? (
        <div className={styles.editor}>
          <div className={styles.editorControl}>
            {renderEditor({
              draft,
              getPopupContainer,
              save: () => void commitDraft(),
              saving,
              setDraft,
            })}
          </div>
          {error ? (
            <Typography.Text
              aria-live="polite"
              className={styles.error}
              id={errorId}
              role="alert"
            >
              {error}
            </Typography.Text>
          ) : null}
        </div>
      ) : (
        <div className={styles.display}>{renderDisplay()}</div>
      )}
      {available && !active ? (
        <Button
          aria-label={ariaLabel}
          className={cx(styles.editButton, 'inline-edit-action')}
          icon={<EditOutlined />}
          size="small"
          tabIndex={activateOnContainerClick ? -1 : 0}
          title={ariaLabel}
          type="text"
          onClick={(event) => {
            event.stopPropagation();
            onRequestActivate(fieldKey);
          }}
        />
      ) : null}
    </div>
  );
}
