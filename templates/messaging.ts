export const townSquareGlobalCard = [
  {
    type: 'section',
    text: {
      type: 'kmarkdown',
      content: `**游戏信息** - (font)该卡片信息由(font)[secondary](font)说书人(font)[warning](font)提供(font)[secondary]`,
    },
  },
  {
    type: 'divider',
  },
];

export const townSquarePrivateCardDefault = [
  {
    type: 'section',
    text: {
      type: 'kmarkdown',
      content: `**说书人托梦** - (font)该卡片信息仅你可见(font)[secondary]\n(font)(若重开后数据丢失，点击刷新按钮可重新获取)(font)[tips]`,
    },
    mode: 'right',
    accessory: {
      type: 'button',
      theme: 'info',
      text: {
        type: 'plain-text',
        content: '刷新',
      },
      click: 'return-val',
      value: '[pl]RefreshPrivate|0',
    },
  },
  {
    type: 'divider',
  },
  {
    type: 'section',
    text: {
      type: 'kmarkdown',
      content: `(font)卡片上空空如也...(font)[tips]`,
    },
  },
];

export const townSquarePrivateCardHeader = (seq: string, userId: string) => [
  {
    type: 'section',
    text: {
      type: 'kmarkdown',
      content: `**说书人托梦** - (font)该卡片信息仅你可见(font)[secondary] (met)${userId}(met)}`,
    },
    mode: 'right',
    accessory: {
      type: 'button',
      theme: 'info',
      text: {
        type: 'plain-text',
        content: '刷新',
      },
      click: 'return-val',
      value: `[pl]RefreshPrivate|${seq}`,
    },
  },
  {
    type: 'divider',
  },
];

export const globalMessagingCard = [
  {
    type: 'section',
    text: {
      type: 'kmarkdown',
      content: `**游戏信息** - 发送消息更新该卡片\n(font)(最多可以保留10条消息)(font)[tips]\n(font)该卡片内容所有玩家可见(font)[secondary]`,
    },
    mode: 'right',
    accessory: {
      type: 'button',
      theme: 'danger',
      text: {
        type: 'plain-text',
        content: '清空卡片',
      },
      click: 'return-val',
      value: '[st]ClearGlobalCard',
    },
  },
  {
    type: 'divider',
  },
];

export const privateMessagingCard = (userId: string) => [
  {
    type: 'section',
    text: {
      type: 'kmarkdown',
      content: `**(font)托梦信息(font)[warning]** - 发送消息更新该卡片\n(font)(最多可以保留10条消息)(font)[tips]\n(font)该卡片内容仅(font)[secondary](met)${userId}(met)(font)可见(font)[secondary]`,
    },
    mode: 'right',
    accessory: {
      type: 'button',
      theme: 'danger',
      text: {
        type: 'plain-text',
        content: '清空卡片',
      },
      click: 'return-val',
      value: '[st]ClearPrivateCard',
    },
  },
  {
    type: 'divider',
  },
];
