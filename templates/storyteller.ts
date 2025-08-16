import type { ActionGroup, ButtonList } from './types';

export interface StorytellerTemplateParams {
  /** 抬头图片 */
  image: string;

  /** 状态信息 */
  status: string;

  /** 按钮列表 */
  buttons?: ButtonList;

  /** 按钮分组 */
  groups?: ActionGroup[];

  /** 底部信息 */
  footer?: string;
}

export const storytellerTwig = async () => {
  return await Bun.file('./templates/storyteller.twig').text();
};
