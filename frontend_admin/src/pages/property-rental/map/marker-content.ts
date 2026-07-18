type BuildingInfo = {
  id: number;
  name: string;
  address: string;
  estate?: { display_name?: string | null; name?: string | null } | null;
  counts: {
    total: number;
    vacant: number;
    rented: number;
  };
};

function appendText(parent: HTMLElement, text: string, cssText?: string) {
  const element = document.createElement('span');
  if (cssText) element.style.cssText = cssText;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function appendLink(
  parent: HTMLElement,
  label: string,
  href: string,
  primary = false,
) {
  const link = document.createElement('a');
  link.href = href;
  link.textContent = label;
  link.style.cssText = primary
    ? 'color:#fff;background:#1677ff;border-radius:6px;padding:5px 10px;text-decoration:none;'
    : 'color:#1677ff;padding:5px 4px;text-decoration:none;';
  parent.appendChild(link);
}

function createMapBubble(
  ariaLabel: string,
  lines: Array<{ text: string; emphasis?: boolean }>,
  options: {
    size: number;
    color?: string;
    selected?: boolean;
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
  return content;
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
    },
  );
}

export function createEstateClusterMarkerContent(options: {
  estateCount: number;
  buildingCount: number;
  primaryLabel: string;
  primaryValue: number;
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
    { size: 82, color: '#0958d9' },
  );
}

export function createBuildingCompactMarkerContent(options: {
  name: string;
  primaryLabel: string;
  primaryValue: number;
  selected?: boolean;
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
  appendText(content, `${options.primaryValue} 套`, 'display:block;');
  return content;
}

export function createBuildingLocationMarkerContent(
  total: number,
): HTMLDivElement {
  const content = document.createElement('div');
  content.setAttribute('aria-label', `${total} 套房源`);
  content.style.cssText =
    'display:flex;flex-direction:column;align-items:center;min-width:48px;pointer-events:none;';

  appendText(
    content,
    `${total} 套`,
    'display:block;background:#fff;color:#1677ff;border:1px solid #91caff;border-radius:10px;padding:1px 6px;font-size:12px;font-weight:600;line-height:18px;white-space:nowrap;box-shadow:0 2px 6px #0002;margin-bottom:3px;',
  );

  const pin = document.createElement('span');
  pin.style.cssText =
    'display:flex;align-items:center;justify-content:center;width:22px;height:22px;background:#1677ff;border:2px solid #fff;border-radius:50% 50% 50% 0;box-shadow:0 2px 6px #0004;transform:rotate(-45deg);';
  const dot = document.createElement('span');
  dot.style.cssText =
    'display:block;width:7px;height:7px;background:#fff;border-radius:50%;';
  pin.appendChild(dot);
  content.appendChild(pin);

  return content;
}

export function createBuildingClusterMarkerContent(
  count: number,
): HTMLDivElement {
  const content = document.createElement('div');
  content.setAttribute('aria-label', `${count} 栋楼栋`);
  content.style.cssText =
    'display:flex;align-items:center;justify-content:center;width:42px;height:42px;color:#fff;background:#1677ff;border:3px solid #ffffffcc;border-radius:50%;font-size:12px;font-weight:600;white-space:nowrap;box-shadow:0 2px 8px #0004;pointer-events:none;';
  content.textContent = `${count} 栋`;
  return content;
}

export function createBuildingInfoWindowContent(
  building: BuildingInfo,
  options: { adminBasePath: string; returnTo: string },
): HTMLDivElement {
  const content = document.createElement('div');
  content.setAttribute('role', 'group');
  content.setAttribute('aria-label', `${building.name}楼栋信息`);
  content.style.cssText = 'width:280px;padding:4px 2px;color:#262626;';

  appendText(
    content,
    building.name,
    'display:block;font-size:16px;font-weight:600;margin-bottom:4px;',
  );
  const estateName =
    building.estate?.display_name || building.estate?.name || '非小区楼栋';
  appendText(
    content,
    `${estateName} · ${building.address}`,
    'display:block;color:#8c8c8c;line-height:1.5;margin-bottom:10px;',
  );

  const counts = document.createElement('div');
  counts.style.cssText = 'display:flex;gap:14px;margin-bottom:10px;';
  appendText(counts, `房源 ${building.counts.total}`);
  appendText(counts, `空置 ${building.counts.vacant}`, 'color:#8c8c8c;');
  appendText(counts, `已租 ${building.counts.rented}`, 'color:#8c8c8c;');
  content.appendChild(counts);

  const actions = document.createElement('div');
  actions.style.cssText =
    'display:flex;align-items:center;gap:6px;border-top:1px solid #f0f0f0;padding-top:10px;';
  appendLink(
    actions,
    '查看房源',
    `${options.adminBasePath}/property-rental/houses?building_id=${building.id}`,
    true,
  );
  appendLink(
    actions,
    '楼栋详情',
    `${options.adminBasePath}/property-rental/buildings/${building.id}?return_to=${encodeURIComponent(options.returnTo)}`,
  );
  appendLink(
    actions,
    '编辑位置',
    `${options.adminBasePath}/property-rental/estates?view=buildings&building_edit=${building.id}&return_to=${encodeURIComponent(options.returnTo)}`,
  );
  content.appendChild(actions);

  return content;
}
