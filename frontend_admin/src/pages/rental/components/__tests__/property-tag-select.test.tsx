import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  getInheritedPropertyTags,
  normalizePropertyTags,
  PropertyTagSelect,
} from '../PropertyTagSelect';

type HarnessProps = React.ComponentProps<typeof PropertyTagSelect> & {
  onValueChange?: (value: string[]) => void;
};

function PropertyTagSelectHarness({
  onValueChange,
  value: initialValue = [],
  ...props
}: HarnessProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <PropertyTagSelect
      {...props}
      value={value}
      onChange={(nextValue) => {
        setValue(nextValue);
        onValueChange?.(nextValue);
      }}
    />
  );
}

describe('PropertyTagSelect utilities', () => {
  it('normalizes whitespace and removes empty or duplicate tags while preserving order', () => {
    expect(
      normalizePropertyTags([
        '  近地铁  ',
        '',
        '采光   好',
        '近地铁',
        '  ',
        '南北\t通透',
      ]),
    ).toEqual(['近地铁', '采光 好', '南北 通透']);
  });

  it('returns only normalized inherited tags not already owned by the house', () => {
    expect(
      getInheritedPropertyTags(
        ['近地铁', '采光   好'],
        [' 近地铁 ', '有   电梯', '有 电梯', '拎包入住'],
      ),
    ).toEqual(['有 电梯', '拎包入住']);
  });
});

describe('PropertyTagSelect', () => {
  it('accepts manual tags separated by Chinese and Western punctuation', () => {
    const onValueChange = vi.fn();
    render(
      <PropertyTagSelectHarness
        aria-label="房源标签"
        onValueChange={onValueChange}
      />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: '房源标签' }), {
      target: {
        value: ' 采光   好,独立阳台，南北通透;采光 好；拎包入住、交通便利、',
      },
    });

    expect(onValueChange).toHaveBeenLastCalledWith([
      '采光 好',
      '独立阳台',
      '南北通透',
      '拎包入住',
      '交通便利',
    ]);
  });

  it('does not emit inherited tags as house-owned tags', () => {
    const onValueChange = vi.fn();
    render(
      <PropertyTagSelectHarness
        aria-label="房源标签"
        value={['近地铁']}
        suggestions={['采光好']}
        inheritedTags={['近地铁', '有   电梯', '采光好']}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: '房源标签' }), {
      target: { value: '采光好,' },
    });

    expect(onValueChange).toHaveBeenLastCalledWith(['近地铁', '采光好']);
  });

  it('keeps manual entry enabled when suggestions fail to load and supports clearing', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <PropertyTagSelectHarness
        aria-label="房源标签"
        value={['近地铁']}
        suggestionsError
        onValueChange={onValueChange}
      />,
    );

    fireEvent.mouseDown(
      container.querySelector('.ant-select-clear') as Element,
    );
    expect(onValueChange).toHaveBeenLastCalledWith([]);
  });
});
