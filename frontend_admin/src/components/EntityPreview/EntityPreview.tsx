import { Link } from '@umijs/max';
import { Popover } from 'antd';
import { createStyles } from 'antd-style';
import { type KeyboardEvent, Suspense, useState } from 'react';
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
  const [open, setOpen] = useState(false);
  const definition = entityPreviewRegistry[type];

  if (!id || !definition) {
    return <>{children}</>;
  }

  const Panel = definition.Panel;
  const target = href || definition.getHref(id);

  return (
    <Popover
      content={
        <EntityPreviewBoundary key={`${type}:${id}`}>
          {open ? (
            <Suspense fallback={<EntityPreviewSkeleton />}>
              <Panel id={id} />
            </Suspense>
          ) : (
            <EntityPreviewSkeleton />
          )}
        </EntityPreviewBoundary>
      }
      destroyOnHidden
      mouseEnterDelay={0.2}
      onOpenChange={setOpen}
      open={open}
      trigger={['hover', 'focus']}
    >
      <span className={styles.trigger}>
        <Link
          className={styles.link}
          onKeyDown={(event: KeyboardEvent<HTMLAnchorElement>) => {
            if (event.key === 'Escape') {
              setOpen(false);
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
