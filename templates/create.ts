const buttonText = '如果你是「说书人」，点击**(font)【创建】(font)[primary]**按钮创建小镇';

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
        mode: 'right',
        accessory: {
          type: 'button',
          theme: 'primary',
          text: {
            type: 'plain-text',
            content: '创建',
          },
          click: 'return-val',
          value: 'createRoom',
        },
      },
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
        mode: 'right',
        accessory: {
          type: 'button',
          theme: 'primary',
          text: {
            type: 'plain-text',
            content: '创建',
          },
          click: 'return-val',
          value: 'createRoom',
        },
      },
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
        mode: 'right',
        accessory: {
          type: 'button',
          theme: 'primary',
          text: {
            type: 'plain-text',
            content: '创建',
          },
          click: 'return-val',
          value: 'createRoom',
        },
      },
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
