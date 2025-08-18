/**
 * State management utility for reactive properties
 *
 * Usage:
 * const name = $state('Initial Value');
 *
 * // Pass to card state
 * const card = new TownControlCard({ name, invite: $state(''), open: $state(false) });
 *
 * // When you update the state, the card automatically updates
 * name.set('New Value');
 *
 * // Check the value
 * if (name.value) { ... }
 */

export type StateListener = () => void;

export interface StateEvents<T> {
  addListener: (listener: StateListener) => void;
  removeListener: (listener: StateListener) => void;
}

/**
 * Base interface for all reactive state types
 */
export interface ReactiveState<T> {
  readonly _events_: StateEvents<T>;
}

/**
 * Reactive state for primitive values (string, number, boolean, null, undefined)
 */
export class CValue<T> implements ReactiveState<T> {
  protected _value: T;
  protected listeners = new Set<StateListener>();

  constructor(initialValue: T) {
    this._value = initialValue;
  }

  /** Get the current value */
  get value(): T {
    return this._value;
  }

  /** Set a new value and notify listeners */
  set(value: T): void {
    // Only notify if value actually changed
    if (this._value !== value) {
      this._value = value;
      this.notifyListeners();
    }
  }

  /** Get events interface for card integration */
  get _events_(): StateEvents<T> {
    return {
      addListener: (listener: StateListener) => {
        this.listeners.add(listener);
      },
      removeListener: (listener: StateListener) => {
        this.listeners.delete(listener);
      },
    };
  }

  /** Trigger an update, this is useful when you want to trigger updates after editing an object */
  update() {
    this.notifyListeners();
  }

  protected notifyListeners(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  /** For debugging */
  toString(): string {
    return String(this._value);
  }

  /** For debugging */
  valueOf(): T {
    return this._value;
  }

  /** For Node.js/Bun inspection */
  [Symbol.for('nodejs.util.inspect.custom')](): T {
    return this._value;
  }

  inspect(): T {
    return this._value;
  }
}

/**
 * Create a reactive array that behaves like a normal array but triggers updates
 */
export type CArray<T> = T[] & ReactiveState<T[]>;

function makeCArray<T>(initialValue: T[] = []): CArray<T> {
  const listeners = new Set<StateListener>();

  const notifyListeners = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const events: StateEvents<T[]> = {
    addListener: (listener: StateListener) => {
      listeners.add(listener);
    },
    removeListener: (listener: StateListener) => {
      listeners.delete(listener);
    },
  };

  const target = [...initialValue];

  return new Proxy(target, {
    get(target, prop) {
      // Handle array methods that should trigger updates
      if (prop === 'push') {
        return (...items: T[]) => {
          // Only notify if we're actually adding items
          if (items.length > 0) {
            const result = Array.prototype.push.apply(target, items);
            notifyListeners();
            return result;
          }
          return target.length;
        };
      }

      if (prop === 'pop') {
        return () => {
          // Only notify if array is not empty
          if (target.length > 0) {
            const result = Array.prototype.pop.call(target);
            notifyListeners();
            return result;
          }
          return undefined;
        };
      }

      if (prop === 'shift') {
        return () => {
          // Only notify if array is not empty
          if (target.length > 0) {
            const result = Array.prototype.shift.call(target);
            notifyListeners();
            return result;
          }
          return undefined;
        };
      }

      if (prop === 'unshift') {
        return (...items: T[]) => {
          // Only notify if we're actually adding items
          if (items.length > 0) {
            const result = Array.prototype.unshift.apply(target, items);
            notifyListeners();
            return result;
          }
          return target.length;
        };
      }

      if (prop === 'splice') {
        return (start: number, deleteCount: number = 0, ...items: T[]) => {
          // Check if this operation will actually change the array
          const willDelete = deleteCount > 0 && start < target.length;
          const willAdd = items.length > 0;

          if (willDelete || willAdd) {
            const result = Array.prototype.splice.apply(target, [start, deleteCount, ...items]);
            notifyListeners();
            return result;
          }

          // No change, return empty array
          return [];
        };
      }

      if (prop === '_events_') {
        return events;
      }

      // Handle all other array properties and methods
      return target[prop as keyof T[]];
    },

    set(target, prop, value) {
      // Handle length changes
      if (prop === 'length') {
        const oldLength = target.length;

        // Only notify if length actually changed
        if (oldLength !== value) {
          target.length = value;
          notifyListeners();
        }
        return true;
      }

      const oldValue = target[prop as keyof T[]];
      if (oldValue !== value || (typeof value === 'object' && value !== null)) {
        (target as any)[prop] = value;
        notifyListeners();
      }
      return true;
    },
  }) as CArray<T>;
}

export type CRecord<K extends keyof any, T> = Record<K, T> & ReactiveState<T>;

/**
 * Create a reactive record that behaves like a normal object but triggers updates
 */
function makeCRecord<K extends keyof any, T>(initialValue: Record<K, T>): CRecord<K, T> {
  const listeners = new Set<StateListener>();

  const notifyListeners = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const events: StateEvents<Record<K, T>> = {
    addListener: (listener: StateListener) => {
      listeners.add(listener);
    },
    removeListener: (listener: StateListener) => {
      listeners.delete(listener);
    },
  };

  const target = { ...initialValue };

  return new Proxy(target, {
    get(target, prop) {
      if (prop === '_events_') {
        return events;
      }

      // Handle all other object properties
      return (target as any)[prop];
    },

    set(target, prop, value) {
      // Handle string properties
      const oldValue = (target as any)[prop];

      // Only notify if value actually changed
      if (oldValue !== value || (typeof value === 'object' && value !== null)) {
        (target as any)[prop] = value;
        notifyListeners();
      }
      return true;
    },

    has(target, prop) {
      return prop in target;
    },

    ownKeys(target) {
      return Object.keys(target);
    },

    getOwnPropertyDescriptor(target, prop) {
      return Object.getOwnPropertyDescriptor(target, prop);
    },
  }) as CRecord<K, T>;
}

// Overloads for type inference
export function $state<T>(initialValue: T): CValue<T>;

/**
 * Create a reactive state
 */
export function $state<T>(initialValue: T): CValue<T> {
  return new CValue(initialValue);
}

/**
 * Create a reactive array
 */
export function $array<T>(initialValue: T[]): CArray<T> {
  return makeCArray(initialValue);
}

/**
 * Create a reactive record
 */
export function $record<K extends keyof any, T>(initialValue: Record<K, T>): CRecord<K, T> {
  return makeCRecord(initialValue);
}
