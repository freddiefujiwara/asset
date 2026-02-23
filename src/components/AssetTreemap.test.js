import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import AssetTreemap from './AssetTreemap.vue';

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

describe('AssetTreemap', () => {
  const tiles = [
    { name: '年金A', value: 100000, dailyChange: 1234, profit: 100, changeRate: 1.25 }
  ];

  it('shows change percentage by default', () => {
    const wrapper = mount(AssetTreemap, {
      props: {
        title: '保有銘柄（評価額）',
        tiles,
      },
    });

    // The new implementation shows percentage in the tile
    expect(wrapper.text()).toContain('1.25%');
  });

  it('hides change percentage when showDailyChange is false', () => {
    const wrapper = mount(AssetTreemap, {
      props: {
        title: '保有銘柄（評価額）',
        tiles,
        showDailyChange: false,
      },
    });

    expect(wrapper.text()).not.toContain('1.25%');
  });
});
