import { describe, expect, test } from 'vitest';

import {
  DEFAULT_SIDEBAR_MENU_ORDER,
  getVisibleSidebarMenuItems,
  moveSidebarMenuItem,
  normalizeSidebarMenuPreferences,
  type SidebarMenuPreferences,
  toggleSidebarMenuItem,
} from './sidebar-menu-customization';

describe('sidebar menu customization preferences', () => {
  test('normalizeSidebarMenuPreferences__given_unknown_and_duplicate_values__then_keeps_valid_unique_order_and_appends_missing_defaults', () => {
    const preferences = normalizeSidebarMenuPreferences({
      hidden: ['analytics', 'unknown', 'analytics'],
      order: ['crm', 'unknown', 'allDocs', 'crm'],
    } as SidebarMenuPreferences);

    expect(preferences.hidden).toEqual(['analytics']);
    expect(preferences.order.slice(0, 2)).toEqual(['crm', 'allDocs']);
    expect(preferences.order).toHaveLength(DEFAULT_SIDEBAR_MENU_ORDER.length);
    expect(new Set(preferences.order).size).toBe(preferences.order.length);
  });

  test('toggleSidebarMenuItem__given_visible_item__then_hides_and_restores_without_reordering', () => {
    const hidden = toggleSidebarMenuItem(
      { order: ['crm', 'allDocs'] },
      'analytics'
    );
    expect(hidden.hidden).toEqual(['analytics']);
    expect(hidden.order.slice(0, 2)).toEqual(['crm', 'allDocs']);

    const restored = toggleSidebarMenuItem(hidden, 'analytics');
    expect(restored.hidden).toEqual([]);
    expect(restored.order.slice(0, 2)).toEqual(['crm', 'allDocs']);
  });

  test('moveSidebarMenuItem__given_middle_item__then_moves_item_up_or_down', () => {
    const preferences = normalizeSidebarMenuPreferences({
      order: ['allDocs', 'analytics', 'crm'],
    });

    expect(moveSidebarMenuItem(preferences, 'analytics', 'up').order).toEqual([
      'analytics',
      'allDocs',
      'crm',
      ...DEFAULT_SIDEBAR_MENU_ORDER.filter(
        key => !['allDocs', 'analytics', 'crm'].includes(key)
      ),
    ]);

    expect(moveSidebarMenuItem(preferences, 'analytics', 'down').order).toEqual(
      [
        'allDocs',
        'crm',
        'analytics',
        ...DEFAULT_SIDEBAR_MENU_ORDER.filter(
          key => !['allDocs', 'analytics', 'crm'].includes(key)
        ),
      ]
    );
  });

  test('moveSidebarMenuItem__given_boundary_item__then_returns_normalized_preferences', () => {
    const preferences = normalizeSidebarMenuPreferences({
      order: ['allDocs', 'analytics'],
    });

    expect(moveSidebarMenuItem(preferences, 'allDocs', 'up')).toEqual(
      preferences
    );
  });

  test('getVisibleSidebarMenuItems__given_hidden_and_custom_order__then_returns_available_items_in_preference_order', () => {
    const visible = getVisibleSidebarMenuItems(
      [
        { key: 'allDocs', value: 'all' },
        { key: 'analytics', value: 'analytics' },
        { key: 'crm', value: 'crm' },
      ],
      {
        hidden: ['analytics'],
        order: ['crm', 'allDocs', 'analytics'],
      }
    );

    expect(visible).toEqual([
      { key: 'crm', value: 'crm' },
      { key: 'allDocs', value: 'all' },
    ]);
  });
});
