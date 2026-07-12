export function createBuildingMarkerContent(name: string, total: number, color: string): HTMLDivElement {
  const content = document.createElement('div');
  content.style.cssText = `background:${color};color:#fff;border-radius:16px;padding:4px 8px;white-space:nowrap;box-shadow:0 2px 6px #0003`;
  content.textContent = `${name} · ${total}`;
  return content;
}
