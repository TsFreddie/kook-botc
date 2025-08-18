import type { ActionGroup } from '../templates/types';

export const ROAMING_LOCATIONS = [
  { name: '🏞️ 河边', theme: 'info' },
  { name: '⛪ 教堂', theme: 'success' },
  { name: '🍻 酒馆', theme: 'warning' },
  { name: '🏛️ 遗迹', theme: 'primary' },
  { name: '📚 缮写室', theme: 'warning' },
  { name: '🌲 小树林', theme: 'primary' },
  { name: '🏠 我的小屋', theme: 'info', isCottage: true },
  { name: '🏢 城镇广场', theme: 'danger', isMain: true },
];

export const LOCATION_BUTTONS: ActionGroup[] = [];
for (let i = 0; i < ROAMING_LOCATIONS.length; i += 4) {
  const buttons = ROAMING_LOCATIONS.slice(i, i + 4).map((value, index) => {
    return {
      text: value.name,
      theme: value.theme,
      value: '[lc]' + (i + index).toString(),
    };
  });
  (LOCATION_BUTTONS as any).push(buttons);
}
