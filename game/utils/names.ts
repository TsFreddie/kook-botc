import names from './names.json';

export const randomTownName = () => {
  const first = names.prefix[Math.floor(Math.random() * names.prefix.length)];
  const second = names.suffix[Math.floor(Math.random() * names.suffix.length)];
  return `${first}${second}`;
};
