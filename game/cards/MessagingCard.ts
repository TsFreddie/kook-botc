import { $card, Card } from '../utils/card';
import type { CArray, CValue } from '../utils/state';

interface Props {
  theme?: CValue<'warning' | 'secondary'>;
  first?: CValue<any[]>;
  empty?: any;
  modules: CArray<any[]>;
}

/**
 * 信息卡片
 */
class CardRenderer extends Card<Props> {
  // 信息卡片由于有用户提供的数据，静默报错。出错不报错也不销毁
  override suppressError = true;

  render(state: Props) {
    const modules: any[] = [];

    if (state.first?.value) {
      modules.push(...state.first.value);
    }

    if (state.modules.length === 0) {
      if (state.empty) {
        modules.push(state.empty);
      }
    } else {
      modules.push(...state.modules);
    }

    return {
      content: JSON.stringify([
        {
          type: 'card',
          theme: state.theme?.value ?? 'secondary',
          size: 'lg',
          modules: modules,
        },
      ]),
    };
  }
}

export default (state: Props) => $card(new CardRenderer(state));
