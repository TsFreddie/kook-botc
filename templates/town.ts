/** 全局城镇管理卡片 */
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
        type: 'section',
        text: {
          type: 'kmarkdown',
          content:
            '> (font)游戏过程中请始终查看该频道，否则可能会错过重要消息(font)[secondary]\n> (font)若不小心退出了语音，可以使用邀请连接重新进入城镇广场语音(font)[secondary]',
        },
      },
      {
        type: 'action-group',
        elements: [
          {
            type: 'button',
            theme: isOpen ? 'warning' : 'info',
            text: {
              type: 'plain-text',
              content: isOpen ? '取消开放' : '开放小镇',
            },
            click: 'return-val',
            value: isOpen ? '[st]gameInviteOnly' : '[st]gameOpen',
          },
          {
            type: 'button',
            theme: 'danger',
            text: {
              type: 'plain-text',
              content: '拆除',
            },
            click: 'return-val',
            value: '[st]gameDelete',
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

/** 城镇信息说明 */
export const townHeader = (name: string, invite: string) => [
  {
    type: 'card',
    theme: 'secondary',
    size: 'lg',
    modules: [
      {
        type: 'section',
        text: {
          type: 'kmarkdown',
          content: `**(font)${name}(font)[warning]**`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'kmarkdown',
          content: `> (font)游戏过程中请始终查看该频道，否则可能会错过重要消息(font)[secondary]\n> (font)若不小心退出了语音，可以点(font)[secondary][这里](${invite}})(font)重新进入城镇广场语音(font)[secondary]`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'plain-text',
            content: '友善交流，文明游戏',
          },
        ],
      },
    ],
  },
];
