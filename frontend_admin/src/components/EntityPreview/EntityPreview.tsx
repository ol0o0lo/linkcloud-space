import { Link } from '@umijs/max';
import { Popover } from 'antd';
import { createStyles } from 'antd-style';
import {
  type KeyboardEvent,
  type PointerEvent,
  Suspense,
  useEffect,
  useRef,
  useState,
} from 'react';
import { EntityPreviewBoundary } from './EntityPreviewBoundary';
import { EntityPreviewSkeleton } from './EntityPreviewState';
import { entityPreviewRegistry } from './registry';
import type { EntityPreviewProps } from './types';

const useStyles = createStyles(({ token }) => ({
  trigger: {
    display: 'inline-block',
    maxWidth: '100%',
  },
  link: {
    color: token.colorText,
    display: 'inline-block',
    maxWidth: '100%',
    minWidth: 0,
    transition: `color ${token.motionDurationMid}`,
    '&:hover, &:focus, &:focus-visible': {
      color: token.colorLink,
    },
  },
}));

export function EntityPreview({
  children,
  href,
  id,
  type,
}: EntityPreviewProps) {
  const { styles } = useStyles();
  const [focusOpen, setFocusOpen] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const focusExitTimerRef = useRef<number | undefined>(undefined);
  const pointerWithinPreviewRef = useRef(false);
  const suppressFocusRef = useRef(false);
  const suppressFocusTimerRef = useRef<number | undefined>(undefined);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const definition = entityPreviewRegistry[type];
  const open = focusOpen || hoverOpen;

  useEffect(
    () => () => {
      window.clearTimeout(focusExitTimerRef.current);
      window.clearTimeout(suppressFocusTimerRef.current);
    },
    [],
  );

  if (!id || !definition) {
    return <>{children}</>;
  }

  const Panel = definition.Panel;
  const target = href || definition.getHref(id);
  const clearFocusExitTimer = () => {
    window.clearTimeout(focusExitTimerRef.current);
    focusExitTimerRef.current = undefined;
  };
  const handleFocusCapture = () => {
    clearFocusExitTimer();
    if (!suppressFocusRef.current) {
      setFocusOpen(true);
    }
  };
  const handleBlurCapture = () => {
    clearFocusExitTimer();
    focusExitTimerRef.current = window.setTimeout(() => {
      const activeElement = document.activeElement;
      const focusRemainsInside =
        triggerRef.current?.contains(activeElement) ||
        contentRef.current?.contains(activeElement);
      if (!focusRemainsInside) {
        setFocusOpen(false);
        if (pointerWithinPreviewRef.current) {
          setHoverOpen(true);
        }
      }
    }, 0);
  };
  const handlePointerOverCapture = () => {
    pointerWithinPreviewRef.current = true;
  };
  const handlePointerOutCapture = (event: PointerEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node &&
      (triggerRef.current?.contains(nextTarget) ||
        contentRef.current?.contains(nextTarget))
    ) {
      return;
    }
    pointerWithinPreviewRef.current = false;
  };
  const closeFromContent = () => {
    clearFocusExitTimer();
    pointerWithinPreviewRef.current = false;
    suppressFocusRef.current = true;
    setFocusOpen(false);
    setHoverOpen(false);
    triggerRef.current
      ?.querySelector<HTMLElement>('a[href]')
      ?.focus({ preventScroll: true });
    window.clearTimeout(suppressFocusTimerRef.current);
    suppressFocusTimerRef.current = window.setTimeout(() => {
      suppressFocusRef.current = false;
    }, 0);
  };

  return (
    <Popover
      content={
        <div
          onBlurCapture={handleBlurCapture}
          onFocusCapture={handleFocusCapture}
          onKeyDownCapture={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              closeFromContent();
            }
          }}
          onPointerOutCapture={handlePointerOutCapture}
          onPointerOverCapture={handlePointerOverCapture}
          ref={contentRef}
        >
          <EntityPreviewBoundary key={`${type}:${id}`}>
            {open ? (
              <Suspense
                fallback={
                  <EntityPreviewSkeleton
                    variant="popover"
                    withMedia={definition.popoverMedia}
                  />
                }
              >
                <Panel id={id} variant="popover" />
              </Suspense>
            ) : (
              <EntityPreviewSkeleton
                variant="popover"
                withMedia={definition.popoverMedia}
              />
            )}
          </EntityPreviewBoundary>
        </div>
      }
      destroyOnHidden
      mouseEnterDelay={1}
      onOpenChange={setHoverOpen}
      open={open}
      styles={{
        container: { overflow: 'hidden', padding: 0 },
        content: { width: '100%' },
        root: {
          maxWidth: 'calc(100vw - 32px)',
          width: definition.popoverWidth,
        },
      }}
      trigger={['hover']}
    >
      <span
        className={styles.trigger}
        onBlurCapture={handleBlurCapture}
        onFocusCapture={handleFocusCapture}
        onPointerOutCapture={handlePointerOutCapture}
        onPointerOverCapture={handlePointerOverCapture}
        ref={triggerRef}
      >
        <Link
          className={styles.link}
          onKeyDown={(event: KeyboardEvent<HTMLAnchorElement>) => {
            if (event.key === 'Escape') {
              clearFocusExitTimer();
              pointerWithinPreviewRef.current = false;
              setFocusOpen(false);
              setHoverOpen(false);
              return;
            }

            if (event.key === 'ArrowDown') {
              const scrollRegion =
                contentRef.current?.querySelector<HTMLElement>(
                  '[data-entity-preview-scroll]',
                );
              if (scrollRegion) {
                event.preventDefault();
                scrollRegion.focus({ preventScroll: true });
              }
            }
          }}
          to={target}
        >
          {children}
        </Link>
      </span>
    </Popover>
  );
}
