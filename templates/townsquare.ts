
import type { ActionGroup, ButtonList } from './types';

export interface TownsquareTemplateParams {
  /** 抬头图片 */
  image: string;

  /** 状态信息 */
  status: string;

  /** 邀请链接 */
  invite: string;

  /** 按钮分组 */
  groups?: ActionGroup[];

  /** 按钮列表 */
  buttons?: ButtonList;

  /** 底部信息 */
  footer?: string;
}

export const townsqareTwig = async () => {
  return await Bun.file('./templates/townsquare.twig').text();
};
