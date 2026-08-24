import { describe, expect, it } from 'vitest';
import {
  buildPublishWorkbenchRows,
  buildSpaceRisks,
  buildWorkflowTasks,
  getHouseTaskLink,
  getWorkbenchFiltersFromSearch,
} from './model';

const estate = { id: 1, name: 'xinghewan', display_name: '星河湾' };
const building = { id: 10, name: '1 栋', estate_id: 1, estate };
const house = {
  id: 1,
  label: '星河湾 / 1 栋 / 101',
  room_number: '101',
  building_id: 10,
  building,
  landlord_id: null,
  landlord: null,
  images: [],
  videos: [],
  status: 'vacant',
};

describe('space workbench model', () => {
  it('builds publish rows with actionable links', () => {
    const rows = buildPublishWorkbenchRows([house] as never[], [], {});
    expect(rows[0]).toMatchObject({
      key: 'blocked-1',
      stage: 'blocked',
      actionLabel: '处理发布问题',
    });
    expect(getHouseTaskLink(house as never, {}).path).toContain(
      '/rental/properties/1',
    );
  });

  it('builds workflow tasks from viewing records', () => {
    const rows = buildWorkflowTasks(
      [
        {
          id: 4,
          house_id: 1,
          house,
          customer_name: '李客户',
          customer_phone: '13900000000',
          contact_id: null,
          contact: null,
          status: 'converted',
        },
      ] as never[],
      [
        {
          id: 6,
          house_id: 1,
          house,
          customer_name: '王客户',
          customer_phone: '13800000000',
          contact_id: 9,
          contact: { id: 9, name: '王租客', phone: '13800000000' },
          status: 'converted',
        },
      ] as never[],
    );

    expect(rows.map((row) => row.queueKey)).toEqual([
      'contact-missing',
      'converted',
    ]);
  });

  it('builds at most three non-zero risks', () => {
    expect(
      buildSpaceRisks({
        blockedCount: 6,
        missingContactCount: 4,
        readyLeaseCount: 9,
      }),
    ).toEqual([
      {
        key: 'blocked-publish',
        level: 'danger',
        count: 6,
        label: '套房源阻断发布',
      },
      {
        key: 'missing-contact',
        level: 'warning',
        count: 4,
        label: '条记录待补租客',
      },
      {
        key: 'ready-lease',
        level: 'info',
        count: 9,
        label: '条记录待签约',
      },
    ]);
    expect(
      buildSpaceRisks({
        blockedCount: 0,
        missingContactCount: 0,
        readyLeaseCount: 2,
      }),
    ).toHaveLength(1);
  });

  it('parses only supported URL filters', () => {
    expect(
      getWorkbenchFiltersFromSearch('?publish=blocked&workflow=converted'),
    ).toEqual({ publishFilter: 'blocked', workflowFilter: 'converted' });
    expect(getWorkbenchFiltersFromSearch('?publish=nope')).toEqual({
      publishFilter: 'all',
      workflowFilter: 'all',
    });
  });
});
