import { fireEvent, render, screen } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpaceWorkbenchDataValue } from './data/SpaceWorkbenchData';
import { defaultWorkbenchLayout } from './layout/normalize';
import { spaceWidgetDefinitions } from './registry';
import { SpaceWorkbenchContent } from './SpaceWorkbenchContent';

const publishHouse = vi.fn();

vi.mock('@/pages/space/shared', () => ({
  useTenantWorkspace: () => ({ selectedOrgSlug: 'org' }),
}));

const estate = { id: 1, name: 'xinghewan', display_name: '星河湾' };
const building = { id: 10, name: '1 栋', estate_id: 1, estate };
const readyHouse = {
  id: 3,
  label: '星河湾 / 1 栋 / 103',
  room_number: '103',
  building_id: 10,
  building,
  landlord_id: 8,
  landlord: { id: 8, name: '周房东', phone: '13600000000' },
  asking_rent: '4600.00',
  images: [],
  videos: [],
  status: 'vacant',
  status__mapping: '空置',
};

const data: SpaceWorkbenchDataValue = {
  totalHouseCount: 126,
  blockedHouseItems: [],
  readyHouseItems: [readyHouse] as never[],
  missingContactCount: 4,
  readyLeaseCount: 9,
  publishRows: [
    {
      key: 'ready-3',
      stage: 'ready',
      house: readyHouse as never,
      issues: [],
      actionLabel: '检查后发布',
      actionPath: '/rental/properties/3',
      actionHint: '资料已完整，可直接发布承接带看。',
    },
  ],
  workflowTasks: [
    {
      key: 'viewing-6',
      queueKey: 'converted',
      queue: '成交待签约',
      title: '王客户 待签约',
      house: { id: 3, label: '星河湾 / 1 栋 / 103' },
      status: '已成交待签约',
      nextStep: '立即创建租约并同步合同资料',
      actionLabel: '去签约',
      actionPath: '/rental/leases?source_viewing_record_id=6',
    },
  ],
  risks: [
    {
      key: 'missing-contact',
      level: 'warning',
      count: 4,
      label: '条记录待补租客',
    },
  ],
  overviewLoading: false,
  overviewError: false,
  publishLoading: false,
  publishError: false,
  workflowLoading: false,
  workflowError: false,
  isFetching: false,
  updatedAt: '15:00',
  retryOverview: vi.fn(),
  retryPublish: vi.fn(),
  retryWorkflow: vi.fn(),
  publishHouse,
  publishing: false,
};

vi.mock('./data/SpaceWorkbenchData', () => ({
  SpaceWorkbenchDataProvider: ({ children }: PropsWithChildren) => children,
  useSpaceWorkbenchData: () => data,
}));

describe('SpaceWorkbenchContent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the redesigned default widgets', () => {
    render(
      <SpaceWorkbenchContent
        layout={defaultWorkbenchLayout(spaceWidgetDefinitions)}
      />,
    );

    expect(screen.getByText('经营总览')).toBeInTheDocument();
    expect(screen.getByText('发布工作区')).toBeInTheDocument();
    expect(screen.getByText('关键风险')).toBeInTheDocument();
    expect(screen.getByText('成交转签')).toBeInTheDocument();
    expect(screen.getByText('空间快捷操作')).toBeInTheDocument();
    expect(screen.getByTestId('space-metric-deck')).toHaveTextContent(
      '在管房源',
    );
    expect(screen.getByTestId('space-publish-queue')).toHaveTextContent(
      '星河湾 / 1 栋 / 103',
    );
    expect(screen.getByTestId('space-risk-stack')).toHaveTextContent('4');
    expect(screen.getByTestId('space-workflow-rail')).toHaveTextContent(
      '王客户 待签约',
    );
    expect(screen.getByTestId('space-quick-actions')).toHaveTextContent(
      '房源管理',
    );
  });

  it('keeps direct house publishing behind confirmation', () => {
    render(
      <SpaceWorkbenchContent
        layout={defaultWorkbenchLayout(spaceWidgetDefinitions)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^发\s*布$/ }));
    expect(screen.getByText('确认发布房源')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /^确\s*认\s*发\s*布$/ }),
    );
    expect(publishHouse).toHaveBeenCalledWith(3);
  });
});
