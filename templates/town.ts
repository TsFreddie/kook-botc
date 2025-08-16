// 全局城镇管理卡片

export const townCard = (name: string, invite: string, isOpen: boolean) => [
  {
    type: 'card',
    theme: 'secondary',
    size: 'lg',
    modules: [
      {
        type: 'section',
        text: {
          type: 'kmarkdown',
          content: `**(font)${name}(font)[warning]** - 邀请连接：[${invite}](${invite})`,
        },
      },
      {
        type: 'action-group',
        elements: [
          {
            type: 'button',
            theme: isOpen ? 'warning' : 'info',
            value: 'ok',
            text: {
              type: 'plain-text',
              content: isOpen ? '取消开放' : '开放小镇',
              click: 'return-val',
              value: isOpen ? '[st]gameInviteOnly' : '[st]gameOpen',
            },
          },
          {
            type: 'button',
            theme: 'danger',
            value: 'cancel',
            text: {
              type: 'plain-text',
              content: '拆除',
              click: 'return-val',
              value: '[st]gameDelete',
            },
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'plain-text',
            content: isOpen ? '目前小镇对所有人开放' : '目前小镇只能通过邀请加入',
          },
        ],
      },
    ],
  },
];
