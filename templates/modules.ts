export const textModule = (text: string) => ({
  type: 'section',
  text: {
    type: 'plain-text',
    content: text,
  },
});

export const imageModule = (url: string) => ({
  type: 'container',
  elements: [
    {
      type: 'image',
      src: url,
    },
  ],
});

export const markdownModule = (text: string) => ({
  type: 'section',
  text: {
    type: 'kmarkdown',
    content: text,
  },
});
