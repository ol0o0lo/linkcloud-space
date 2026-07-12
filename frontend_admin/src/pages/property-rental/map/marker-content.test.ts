import { describe, expect, it } from 'vitest';
import { createBuildingMarkerContent } from './marker-content';

describe('createBuildingMarkerContent', () => {
  it('将楼栋名称作为纯文本写入标点', () => {
    const content = createBuildingMarkerContent('</div><img src=x onerror=alert(1)>', 3, '#1677ff');

    expect(content.querySelector('img')).toBeNull();
    expect(content.textContent).toBe('</div><img src=x onerror=alert(1)> · 3');
  });
});
