import type { ButtonTheme } from '../lib/api';

export type ActionButton = {
  /** 按钮文本 */
  text: string;
  /** 按钮主题 */
  theme: ButtonTheme;
  /** 按钮返回值 */
  value?: string;
};

export type ActionGroup =
  | []
  | [ActionButton]
  | [ActionButton, ActionButton]
  | [ActionButton, ActionButton, ActionButton]
  | [ActionButton, ActionButton, ActionButton, ActionButton];

export type ButtonList = {
  /** 按钮文本 */
  text: string;
  /** 按钮主题 */
  theme: ButtonTheme;
  /** 按钮描述 */
  desc: string;
  /** 按钮返回值 */
  value?: string;
}[];
