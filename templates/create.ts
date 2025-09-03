const buttonText = '如果你是(font)「说书人」(font)[warning]，使用下面的按钮创建小镇';

const createButtons = {
  type: 'action-group',
  elements: [
    {
      type: 'button',
      theme: 'primary',
      text: {
        type: 'plain-text',
        content: '公开小镇',
      },
      click: 'return-val',
      value: 'createPublicRoom',
    },
    {
      type: 'button',
      theme: 'warning',
      text: {
        type: 'plain-text',
        content: '限邀请小镇',
      },
      click: 'return-val',
      value: 'createPrivateRoom',
    },
  ],
};

export const createActionCard = [
  {
    type: 'card',
    modules: [
      {
        type: 'section',
        text: {
          type: 'kmarkdown',
          content: `${buttonText}`,
        },
      },
      createButtons,
    ],
  },
];

export const creatingInfo = [
  {
    type: 'card',
    modules: [
      {
        type: 'section',
        text: {
          type: 'kmarkdown',
          content: '正在创建小镇，请耐心等待...',
        },
      },
    ],
  },
];

export const createdCard = (name: string, channelId: string) => [
  {
    type: 'card',
    theme: 'success',
    size: 'lg',
    modules: [
      {
        type: 'section',
        text: {
          type: 'kmarkdown',
          content: `${buttonText}`,
        },
      },
      createButtons,
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'kmarkdown',
          content: `(font)已创建${name}(font)[success] | 请点击前往：(chn)${channelId}(chn)`,
        },
      },
    ],
  },
];

export const existedCard = (name: string, channelId: string) => [
  {
    type: 'card',
    theme: 'success',
    size: 'lg',
    modules: [
      {
        type: 'section',
        text: {
          type: 'kmarkdown',
          content: `${buttonText}`,
        },
      },
      createButtons,
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'kmarkdown',
          content: `(font)你目前正在${name}进行游戏，若要创建新的小镇需要先拆除或离开小镇(font)[warning]`,
        },
      },
    ],
  },
];
