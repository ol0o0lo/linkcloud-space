import { Link } from '@umijs/max';
import { Popover } from 'antd';
import { createStyles } from 'antd-style';
import { Suspense, useState, type KeyboardEvent } from 'react';
import { EntityPreviewBoundary } from './EntityPreviewBoundary';
import { EntityPreviewSkeleton } from './EntityPreviewState';
import { entityPreviewRegistry } from './registry';
import type { EntityPreviewProps } from './types';

const useStyles = createStyles(({ token }) => ({
  link: {
    color: token.colorText,
    transition: `color ${token.motionDurationMid}`,
    '&:hover, &:focus, &:focus-visible': {
      color: token.colorLink,
    },
  },
}));

export function EntityPreview({ children, href, id, type }: EntityPreviewProps) {
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
        open ? (
          <EntityPreviewBoundary key={`${type}:${id}`}>
            <Suspense fallback={<EntityPreviewSkeleton />}>
              <Panel id={id} />
            </Suspense>
          </EntityPreviewBoundary>
        ) : null
      }
      destroyOnHidden
      mouseEnterDelay={0.2}
      onOpenChange={setOpen}
      open={open}
      trigger={['hover', 'focus']}
    >
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
    </Popover>
  );
}
