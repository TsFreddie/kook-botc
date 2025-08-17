/**
 * State management utility for reactive properties
 *
 * Usage:
 * const [name, setName] = $state('Initial Value');
 *
 * // Pass directly to card state - looks like a normal value
 * const card = new TownControlCard({ name, invite: '', open: false });
 *
 * // When you update the state, the card automatically updates
 * setName('New Value');
 */

export interface StateListener<T> {
  (newValue: T, oldValue: T): void;
}

export interface StateEvents<T> {
  addListener: (listener: StateListener<T>) => void;
  removeListener: (listener: StateListener<T>) => void;
}

export type ReactiveState<T> = [T, (newValue: T) => void] & {
  readonly value: T;
  readonly set: (value: T) => void;
};

/**
 * Create a reactive state with React-style API
 *
 * @param initialValue - Initial value for the state
 * @returns A tuple [value, setValue] where value is a reactive proxy and setValue updates it
 */
export function $state<T>(initialValue: T): ReactiveState<T> {
  let _value = initialValue;
  const listeners = new Set<StateListener<T>>();

  const events: StateEvents<T> = {
    addListener: (listener: StateListener<T>) => {
      listeners.add(listener);
    },
    removeListener: (listener: StateListener<T>) => {
      listeners.delete(listener);
    },
  };

  const setValue = (newValue: T) => {
    const oldValue = _value;
    _value = newValue;
    notifyListeners(newValue, oldValue);
    // Update the proxy's internal value
    (proxy as any)._internalValue = newValue;
  };

  const notifyListeners = (newValue: T, oldValue: T) => {
    for (const listener of listeners) {
      listener(newValue, oldValue);
    }
  };

  // Create a simple object that will act as our reactive value
  const reactiveValue = {
    _state_: true,
    _events_: events,
    _internalValue: _value,

    // Override toString and valueOf for proper string conversion
    toString() {
      return String(this._internalValue);
    },

    valueOf() {
      return this._internalValue;
    },

    // Handle Symbol.toPrimitive for template literals and other conversions
    [Symbol.toPrimitive](hint: string) {
      if (hint === 'number') return Number(this._internalValue);
      if (hint === 'string') return String(this._internalValue);
      return this._internalValue;
    },

    // Handle Node.js/Bun inspection
    [Symbol.for('nodejs.util.inspect.custom')]() {
      return this._internalValue;
    },

    inspect() {
      return this._internalValue;
    },
  };

  // Create a proxy to intercept property access and assignments
  const proxy = new Proxy(reactiveValue, {
    get(target, prop) {
      // Return special properties
      if (prop === '_state_' || prop === '_events_' || prop === '_internalValue') {
        return target[prop as keyof typeof target];
      }

      // Return methods that need to be bound to the target
      if (
        prop === 'toString' ||
        prop === 'valueOf' ||
        prop === Symbol.toPrimitive ||
        prop === Symbol.for('nodejs.util.inspect.custom') ||
        prop === 'inspect'
      ) {
        return target[prop as keyof typeof target];
      }

      // For any other property, try to get it from the actual value
      const value = target._internalValue;
      if (value != null && typeof value === 'object') {
        return (value as any)[prop];
      }

      // For primitives, return undefined for unknown properties
      return undefined;
    },

    set(target, prop, value) {
      if (prop === '_internalValue') {
        target._internalValue = value;
        return true;
      }

      // Any other assignment updates the state value
      const oldValue = target._internalValue;
      target._internalValue = value;
      _value = value;
      notifyListeners(value, oldValue);
      return true;
    },
  });

  const result = [proxy as T, setValue];
  (result as any).value = proxy;
  (result as any).set = setValue;
  return result as any;
}
