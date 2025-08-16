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
          content: '如果你已是「说书人」，点击**【创建】**按钮创建小镇',
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
          content: '如果你已是「说书人」，点击**【创建】**按钮创建小镇',
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
          content: `(font)你目前正在主持${name}，若要创建新的小镇请先前往城镇广场拆除小镇(font)[warning] | 请点击前往：(chn)${channelId}(chn)`,
        },
      },
    ],
  },
];
