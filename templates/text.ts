export const textCard = (text: string) => [
  {
    type: 'card',
    theme: 'secondary',
    size: 'sm',
    modules: [
      {
        type: 'section',
        text: {
          type: 'kmarkdown',
          content: text,
        },
      },
    ],
  },
];
