// Test different approaches to fix truthiness

// Approach 1: Try to make Symbol.toPrimitive work for boolean contexts
function createReactiveValue1(value: any) {
  const obj = {
    _value: value,
    valueOf() { return this._value; },
    toString() { return String(this._value); },
    [Symbol.toPrimitive](hint: string) {
      console.log(`toPrimitive called with hint: ${hint}`);
      return this._value;
    }
  };
  
  return new Proxy(obj, {
    get(target, prop) {
      if (prop in target) return target[prop as keyof typeof target];
      return undefined;
    }
  });
}

// Approach 2: Try to intercept boolean coercion in the proxy
function createReactiveValue2(value: any) {
  const obj = {
    _value: value,
    valueOf() { return this._value; },
    toString() { return String(this._value); },
    [Symbol.toPrimitive](hint: string) {
      return this._value;
    }
  };
  
  return new Proxy(obj, {
    get(target, prop) {
      if (prop in target) return target[prop as keyof typeof target];
      return undefined;
    },
    // Try to intercept property access that might be related to boolean coercion
    has(target, prop) {
      return prop in target;
    }
  });
}

// Approach 3: Return the primitive value directly for simple types
function createReactiveValue3(value: any) {
  // For primitive values, we might need a different strategy
  if (value === null || value === undefined || typeof value !== 'object') {
    // For primitives, create a wrapper that tries to behave like the primitive
    const wrapper = Object.create(null);
    wrapper._value = value;
    wrapper.valueOf = function() { return this._value; };
    wrapper.toString = function() { return String(this._value); };
    wrapper[Symbol.toPrimitive] = function(hint: string) { 
      console.log(`toPrimitive called with hint: ${hint} for value: ${this._value}`);
      return this._value; 
    };
    
    return new Proxy(wrapper, {
      get(target, prop) {
        if (prop in target) return target[prop];
        return undefined;
      }
    });
  }
  
  // For objects, use the original approach
  return createReactiveValue1(value);
}

console.log('=== Testing Truthiness Fix Approaches ===\n');

console.log('Approach 1:');
const val1 = createReactiveValue1(false);
console.log('val1:', val1);
console.log('!!val1:', !!val1);
console.log('val1 ? "truthy" : "falsy":', val1 ? "truthy" : "falsy");
console.log('val1.valueOf():', val1.valueOf());
console.log();

console.log('Approach 2:');
const val2 = createReactiveValue2(false);
console.log('val2:', val2);
console.log('!!val2:', !!val2);
console.log('val2 ? "truthy" : "falsy":', val2 ? "truthy" : "falsy");
console.log('val2.valueOf():', val2.valueOf());
console.log();

console.log('Approach 3:');
const val3 = createReactiveValue3(false);
console.log('val3:', val3);
console.log('!!val3:', !!val3);
console.log('val3 ? "truthy" : "falsy":', val3 ? "truthy" : "falsy");
console.log('val3.valueOf():', val3.valueOf());
console.log();

console.log('Testing with 0:');
const zero1 = createReactiveValue1(0);
const zero2 = createReactiveValue2(0);
const zero3 = createReactiveValue3(0);
console.log('zero1 ? "truthy" : "falsy":', zero1 ? "truthy" : "falsy");
console.log('zero2 ? "truthy" : "falsy":', zero2 ? "truthy" : "falsy");
console.log('zero3 ? "truthy" : "falsy":', zero3 ? "truthy" : "falsy");
console.log();

console.log('Testing with empty string:');
const empty1 = createReactiveValue1("");
const empty2 = createReactiveValue2("");
const empty3 = createReactiveValue3("");
console.log('empty1 ? "truthy" : "falsy":', empty1 ? "truthy" : "falsy");
console.log('empty2 ? "truthy" : "falsy":', empty2 ? "truthy" : "falsy");
console.log('empty3 ? "truthy" : "falsy":', empty3 ? "truthy" : "falsy");
