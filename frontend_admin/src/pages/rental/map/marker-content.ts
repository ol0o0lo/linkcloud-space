import type { HouseOut } from '@/services/manual/house';
import { moneyText } from '../constants';
import externalLinkOutlinedUrl from './external-link-outlined.svg';

type BuildingGroupAreaSource = {
  estate?: {
    id: number;
    name: string;
    display_name?: string | null;
  } | null;
  address?: string | null;
};

function appendText(parent: HTMLElement, text: string, cssText?: string) {
  const element = document.createElement('span');
  if (cssText) element.style.cssText = cssText;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function makeInteractiveMarker(
  content: HTMLDivElement,
  onActivate?: () => void,
) {
  content.setAttribute('role', 'button');
  content.tabIndex = 0;
  if (onActivate) {
    content.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onActivate();
    });
  }
  return content;
}

function appendLocationPin(parent: HTMLElement, color: string) {
  const pin = document.createElement('span');
  pin.dataset.mapLocationPin = 'true';
  pin.style.cssText = `display:flex;align-items:center;justify-content:center;width:22px;height:22px;margin-top:4px;background:${color};border:2px solid #fff;border-radius:50% 50% 50% 0;box-shadow:0 2px 6px #0004;transform:rotate(-45deg);`;
  const dot = document.createElement('span');
  dot.style.cssText =
    'display:block;width:7px;height:7px;background:#fff;border-radius:50%;';
  pin.appendChild(dot);
  parent.appendChild(pin);
}

function appendNewTabIcon(parent: HTMLElement) {
  const icon = document.createElement('span');
  icon.dataset.newTabIndicator = 'true';
  icon.setAttribute('aria-hidden', 'true');
  icon.style.cssText =
    'display:block;width:12px;height:12px;flex:none;background-color:currentColor;opacity:.65;';
  icon.style.setProperty(
    '-webkit-mask',
    `url("${externalLinkOutlinedUrl}") center / contain no-repeat`,
  );
  icon.style.setProperty(
    'mask',
    `url("${externalLinkOutlinedUrl}") center / contain no-repeat`,
  );
  parent.appendChild(icon);
}

function addInteractiveRowFeedback(row: HTMLAnchorElement) {
  let pointerInside = false;
  const update = () => {
    const focused = document.activeElement === row;
    const active = pointerInside || focused;
    row.style.backgroundColor = active ? '#e6f4ff' : 'transparent';
    row.style.color = active ? '#0958d9' : 'inherit';
    row.style.boxShadow = focused ? '0 0 0 2px #91caff' : 'none';
  };
  row.addEventListener('mouseenter', () => {
    pointerInside = true;
    update();
  });
  row.addEventListener('mouseleave', () => {
    pointerInside = false;
    update();
  });
  row.addEventListener('focus', update);
  row.addEventListener('blur', update);
}

function createMapBubble(
  ariaLabel: string,
  lines: Array<{ text: string; emphasis?: boolean }>,
  options: {
    size: number;
    color?: string;
    selected?: boolean;
    onActivate?: () => void;
  },
) {
  const content = document.createElement('div');
  content.setAttribute('aria-label', ariaLabel);
  const color = options.selected ? '#0958d9' : options.color || '#1677ff';
  content.style.cssText = `display:flex;flex-direction:column;align-items:center;justify-content:center;width:${options.size}px;height:${options.size}px;box-sizing:border-box;padding:8px;color:#fff;background:${color};border:3px solid #ffffffdd;border-radius:50%;box-shadow:0 4px 12px #0004;line-height:1.2;text-align:center;white-space:nowrap;pointer-events:none;`;
  for (const line of lines) {
    appendText(
      content,
      line.text,
      line.emphasis
        ? 'display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;font-size:14px;font-weight:700;'
        : 'display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;font-size:11px;margin-top:3px;',
    );
  }
  return makeInteractiveMarker(content, options.onActivate);
}

function formatBubbleMetric(label: string, value: number) {
  return label === '空置' ? `${value} 套` : `${label} ${value} 套`;
}

export function createEstateMapMarkerContent(options: {
  name: string;
  primaryLabel: string;
  primaryValue: number;
  buildingCount: number;
  selected?: boolean;
  onActivate?: () => void;
}): HTMLDivElement {
  return createMapBubble(
    `${options.name}，${options.primaryLabel}${options.primaryValue}套，${options.buildingCount}栋`,
    [
      { text: options.name, emphasis: true },
      {
        text: formatBubbleMetric(options.primaryLabel, options.primaryValue),
        emphasis: true,
      },
      { text: `${options.buildingCount} 栋` },
    ],
    {
      size: 88,
      color: '#1677ff',
      selected: options.selected,
      onActivate: options.onActivate,
    },
  );
}

export function createEstateClusterMarkerContent(options: {
  estateCount: number;
  buildingCount: number;
  primaryLabel: string;
  primaryValue: number;
  onActivate?: () => void;
}): HTMLDivElement {
  return createMapBubble(
    `${options.estateCount}个项目，${options.buildingCount}栋，${options.primaryLabel}${options.primaryValue}套`,
    [
      { text: `${options.estateCount} 个项目`, emphasis: true },
      {
        text: formatBubbleMetric(options.primaryLabel, options.primaryValue),
      },
      { text: `${options.buildingCount} 栋` },
    ],
    { size: 82, color: '#0958d9', onActivate: options.onActivate },
  );
}

export function createBuildingCompactMarkerContent(options: {
  name: string;
  primaryLabel: string;
  primaryValue: number;
  selected?: boolean;
  onActivate?: () => void;
}): HTMLDivElement {
  const content = document.createElement('div');
  content.setAttribute(
    'aria-label',
    `${options.name}，${options.primaryLabel}${options.primaryValue}套`,
  );
  const color = options.selected ? '#0958d9' : '#1677ff';
  content.style.cssText = `display:flex;align-items:center;gap:5px;max-width:150px;padding:6px 10px;color:#fff;background:${color};border:2px solid #ffffffdd;border-radius:18px;box-shadow:0 3px 10px #0004;font-size:12px;white-space:nowrap;pointer-events:none;`;
  appendText(
    content,
    options.name,
    'display:block;max-width:86px;overflow:hidden;text-overflow:ellipsis;font-weight:700;',
  );
  appendText(
    content,
    `${options.primaryLabel} ${options.primaryValue} 套`,
    'display:block;',
  );
  return makeInteractiveMarker(content, options.onActivate);
}

export function createBuildingLocationMarkerContent(options: {
  name: string;
  primaryLabel: string;
  primaryValue: number;
  selected?: boolean;
  onActivate?: () => void;
}): HTMLDivElement {
  const content = document.createElement('div');
  content.setAttribute(
    'aria-label',
    `${options.name}，${options.primaryLabel}${options.primaryValue}套`,
  );
  content.style.cssText =
    'display:inline-flex;flex-direction:column;align-items:center;justify-content:flex-end;width:max-content;min-width:48px;pointer-events:none;';

  const bubble = document.createElement('span');
  const color = options.selected ? '#0958d9' : '#1677ff';
  bubble.style.cssText = `display:flex;align-items:center;align-self:center;gap:6px;max-width:180px;background:#fff;color:${color};border:1px solid ${options.selected ? '#1677ff' : '#91caff'};border-radius:12px;padding:3px 8px;font-size:12px;line-height:18px;white-space:nowrap;box-shadow:0 2px 6px #0002;`;
  appendText(
    bubble,
    options.name,
    'display:block;max-width:92px;overflow:hidden;text-overflow:ellipsis;font-weight:700;',
  );
  appendText(
    bubble,
    `${options.primaryLabel} ${options.primaryValue} 套`,
    'display:block;font-weight:600;',
  );
  content.appendChild(bubble);
  appendLocationPin(content, color);

  return makeInteractiveMarker(content, options.onActivate);
}

export function createBuildingOverviewMarkerContent(options: {
  name: string;
  contextName?: string;
  primaryLabel: string;
  primaryValue: number;
  onActivate?: () => void;
}): HTMLDivElement {
  const content = document.createElement('div');
  content.setAttribute(
    'aria-label',
    [
      options.contextName,
      options.name,
      `${options.primaryLabel}${options.primaryValue}套`,
    ]
      .filter(Boolean)
      .join('，'),
  );
  content.style.cssText =
    'display:inline-flex;flex-direction:column;align-items:center;justify-content:flex-end;width:168px;pointer-events:none;';

  const card = document.createElement('div');
  card.style.cssText =
    'width:100%;box-sizing:border-box;padding:7px 9px;background:#fff;border:1px solid #91caff;border-radius:10px;box-shadow:0 3px 10px #00000024;';
  if (options.contextName)
    appendText(
      card,
      options.contextName,
      'display:block;overflow:hidden;color:#8c8c8c;font-size:10px;line-height:15px;text-overflow:ellipsis;white-space:nowrap;',
    );
  const summary = document.createElement('div');
  summary.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;gap:8px;line-height:18px;';
  appendText(
    summary,
    options.name,
    'display:block;min-width:0;overflow:hidden;color:#262626;font-size:12px;font-weight:700;text-overflow:ellipsis;white-space:nowrap;',
  );
  appendText(
    summary,
    `${options.primaryLabel} ${options.primaryValue} 套`,
    'display:block;flex:none;color:#1677ff;font-size:11px;font-weight:600;white-space:nowrap;',
  );
  card.appendChild(summary);
  content.appendChild(card);
  appendLocationPin(content, '#1677ff');

  return makeInteractiveMarker(content, options.onActivate);
}

export function getBuildingGroupAreaName(buildings: BuildingGroupAreaSource[]) {
  const firstEstate = buildings[0]?.estate;
  if (
    firstEstate &&
    buildings.every((building) => building.estate?.id === firstEstate.id)
  )
    return firstEstate.display_name || firstEstate.name;

  const addresses = buildings
    .map((building) => building.address?.trim())
    .filter((address): address is string => Boolean(address));
  if (addresses.length) {
    let commonPrefix = addresses[0];
    for (const address of addresses.slice(1)) {
      let index = 0;
      while (
        index < commonPrefix.length &&
        index < address.length &&
        commonPrefix[index] === address[index]
      )
        index += 1;
      commonPrefix = commonPrefix.slice(0, index);
      if (!commonPrefix) break;
    }
    const normalizedPrefix = commonPrefix.trim().replace(/[\s·,，、-]+$/g, '');
    if (normalizedPrefix.length >= 4) return normalizedPrefix;
  }
  return '附近楼栋';
}

export function createBuildingGroupMarkerContent(options: {
  areaName: string;
  buildingCount: number;
  buildings: Array<{
    name: string;
    primaryLabel: string;
    primaryValue: number;
  }>;
  onActivate?: () => void;
}): HTMLDivElement {
  const previewBuildings = options.buildings.slice(0, 4);
  const content = document.createElement('div');
  content.setAttribute(
    'aria-label',
    `${options.areaName}，${options.buildingCount}栋，${previewBuildings.map((building) => `${building.name}${building.primaryLabel}${building.primaryValue}套`).join('，')}`,
  );
  content.style.cssText =
    'display:inline-flex;flex-direction:column;align-items:center;justify-content:flex-end;width:220px;pointer-events:none;';

  const card = document.createElement('div');
  card.style.cssText =
    'width:100%;box-sizing:border-box;padding:9px 11px;background:#fff;border:1px solid #69b1ff;border-radius:11px;box-shadow:0 5px 16px #0000002b;';
  const header = document.createElement('div');
  header.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:6px;border-bottom:1px solid #f0f0f0;';
  appendText(
    header,
    options.areaName,
    'display:block;min-width:0;overflow:hidden;color:#262626;font-size:12px;font-weight:700;text-overflow:ellipsis;white-space:nowrap;',
  );
  appendText(
    header,
    `${options.buildingCount} 栋`,
    'display:block;flex:none;color:#595959;font-size:11px;white-space:nowrap;',
  );
  card.appendChild(header);

  for (const [index, building] of previewBuildings.entries()) {
    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;${index ? 'border-top:1px solid #f5f5f5;' : ''}`;
    appendText(
      row,
      building.name,
      'display:block;min-width:0;overflow:hidden;font-size:11px;font-weight:600;text-overflow:ellipsis;white-space:nowrap;',
    );
    appendText(
      row,
      `${building.primaryLabel} ${building.primaryValue} 套`,
      'display:block;flex:none;color:#1677ff;font-size:11px;white-space:nowrap;',
    );
    card.appendChild(row);
  }
  if (options.buildingCount > previewBuildings.length)
    appendText(
      card,
      `另有 ${options.buildingCount - previewBuildings.length} 栋，点击放大查看`,
      'display:block;padding-top:6px;border-top:1px solid #f0f0f0;color:#8c8c8c;font-size:10px;text-align:center;',
    );
  content.appendChild(card);
  appendLocationPin(content, '#0958d9');

  return makeInteractiveMarker(content, options.onActivate);
}

export function createBuildingDetailMarkerContent(options: {
  name: string;
  estateName?: string;
  address?: string;
  totalValue: number;
  primaryLabel: string;
  primaryValue: number;
  houseTotal: number;
  houses: Array<Pick<HouseOut, 'id' | 'room_number' | 'asking_rent'>>;
  houseDetailHref?: (houseId: number) => string;
  loading: boolean;
  error: boolean;
  onActivate?: () => void;
}): HTMLDivElement {
  const previewHouses = options.houses.slice(0, 4);
  const accessibleHouseSummary = previewHouses
    .map(
      (house) =>
        `${house.room_number || `房源${house.id}`}，${house.asking_rent ? `月租${house.asking_rent}元` : '租金待定'}`,
    )
    .join('，');
  const content = document.createElement('div');
  content.setAttribute(
    'aria-label',
    [
      options.name,
      `共${options.totalValue}套房源`,
      `${options.primaryLabel}${options.primaryValue}套`,
      accessibleHouseSummary,
    ]
      .filter(Boolean)
      .join('，'),
  );
  content.style.cssText =
    'display:flex;flex-direction:column;align-items:center;width:268px;color:#1f1f1f;pointer-events:none;';

  const card = document.createElement('div');
  card.style.cssText =
    'width:100%;box-sizing:border-box;padding:12px 14px;background:#fff;border:1px solid #91caff;border-radius:12px;box-shadow:0 8px 24px #00000026;';

  const header = document.createElement('div');
  header.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;gap:12px;';
  appendText(
    header,
    options.name,
    'display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:15px;font-weight:700;white-space:nowrap;',
  );
  appendText(
    header,
    `共 ${options.totalValue} 套房源`,
    'display:block;flex:none;color:#595959;font-size:12px;white-space:nowrap;',
  );
  card.appendChild(header);

  const context = [options.estateName, options.address]
    .filter(Boolean)
    .join(' · ');
  if (context)
    appendText(
      card,
      context,
      'display:block;margin-top:3px;overflow:hidden;color:#8c8c8c;font-size:11px;text-overflow:ellipsis;white-space:nowrap;',
    );

  const previewHeader = document.createElement('div');
  previewHeader.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:9px;border-top:1px solid #f0f0f0;';
  appendText(
    previewHeader,
    options.primaryLabel === '房源'
      ? '房号'
      : `房号 · ${options.primaryLabel} ${options.primaryValue} 套`,
    'display:block;color:#8c8c8c;font-size:11px;font-weight:500;',
  );
  appendText(
    previewHeader,
    '月租',
    'display:block;color:#8c8c8c;font-size:11px;',
  );
  card.appendChild(previewHeader);

  if (options.loading) {
    appendText(
      card,
      '房源加载中…',
      'display:block;padding:14px 0 6px;color:#8c8c8c;font-size:12px;text-align:center;',
    );
  } else if (options.error) {
    appendText(
      card,
      '房源加载失败，可在侧栏重试',
      'display:block;padding:14px 0 6px;color:#ff4d4f;font-size:12px;text-align:center;',
    );
  } else if (!previewHouses.length) {
    appendText(
      card,
      '当前筛选暂无房源',
      'display:block;padding:14px 0 6px;color:#8c8c8c;font-size:12px;text-align:center;',
    );
  } else {
    const list = document.createElement('div');
    list.style.cssText =
      'display:flex;flex-direction:column;gap:2px;margin-top:3px;';
    for (const house of previewHouses) {
      const row = document.createElement(options.houseDetailHref ? 'a' : 'div');
      row.style.cssText = `display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 -6px;padding:8px 6px;border-radius:6px;color:inherit;text-decoration:none;transition:background-color .12s ease,color .12s ease,box-shadow .12s ease;${options.houseDetailHref ? 'cursor:pointer;outline:none;pointer-events:auto;' : ''}`;
      if (row instanceof HTMLAnchorElement && options.houseDetailHref) {
        row.href = options.houseDetailHref(house.id);
        row.target = '_blank';
        row.rel = 'noreferrer';
        row.title = '在新标签页打开房源详情';
        row.setAttribute(
          'aria-label',
          `查看房源 ${house.room_number || house.id}`,
        );
        row.addEventListener('click', (event) => event.stopPropagation());
        addInteractiveRowFeedback(row);
      }
      appendText(
        row,
        house.room_number || `房源 ${house.id}`,
        'display:block;overflow:hidden;font-size:12px;font-weight:600;text-overflow:ellipsis;white-space:nowrap;',
      );
      const rent = document.createElement('span');
      rent.style.cssText =
        'display:flex;align-items:center;flex:none;gap:4px;white-space:nowrap;';
      appendText(
        rent,
        house.asking_rent ? `${moneyText(house.asking_rent)} / 月` : '租金待定',
        `display:block;flex:none;font-size:12px;white-space:nowrap;${house.asking_rent ? 'font-weight:600;' : 'color:#8c8c8c;'}`,
      );
      if (options.houseDetailHref) appendNewTabIcon(rent);
      row.appendChild(rent);
      list.appendChild(row);
    }
    card.appendChild(list);
    if (options.houseTotal > previewHouses.length)
      appendText(
        card,
        `另有 ${options.houseTotal - previewHouses.length} 套，可在侧栏查看`,
        'display:block;padding-top:6px;border-top:1px solid #f0f0f0;color:#8c8c8c;font-size:11px;text-align:center;',
      );
  }
  content.appendChild(card);
  appendLocationPin(content, '#1677ff');

  if (options.houseDetailHref) {
    content.setAttribute('role', 'group');
    return content;
  }
  return makeInteractiveMarker(content, options.onActivate);
}

export function createBuildingClusterMarkerContent(
  count: number,
  onActivate?: () => void,
): HTMLDivElement {
  const content = document.createElement('div');
  content.setAttribute('aria-label', `${count} 栋楼栋`);
  content.style.cssText =
    'display:flex;align-items:center;justify-content:center;width:42px;height:42px;color:#fff;background:#1677ff;border:3px solid #ffffffcc;border-radius:50%;font-size:12px;font-weight:600;white-space:nowrap;box-shadow:0 2px 8px #0004;pointer-events:none;';
  content.textContent = `${count} 栋`;
  return makeInteractiveMarker(content, onActivate);
}
