import { $state, $truthy, $falsy } from './game/utils/state-binder';

// Test function for state-binder
function testStateBinder() {
  console.log('=== Testing State Binder Truthiness ===\n');

  // Test with various falsy values
  const [boolState, setBoolState] = $state(false);
  const [numberState, setNumberState] = $state(0);
  const [stringState, setStringState] = $state("");
  const [nullState, setNullState] = $state(null);
  const [undefinedState, setUndefinedState] = $state(undefined);

  console.log('Raw state values:');
  console.log('boolState:', boolState);
  console.log('numberState:', numberState);
  console.log('stringState:', stringState);
  console.log('nullState:', nullState);
  console.log('undefinedState:', undefinedState);
  console.log();

  console.log('Truthiness tests:');
  console.log('!!boolState:', !!boolState);
  console.log('!!numberState:', !!numberState);
  console.log('!!stringState:', !!stringState);
  console.log('!!nullState:', !!nullState);
  console.log('!!undefinedState:', !!undefinedState);
  console.log();

  console.log('Ternary operator tests:');
  console.log('boolState ? "truthy" : "falsy":', boolState ? "truthy" : "falsy");
  console.log('numberState ? "truthy" : "falsy":', numberState ? "truthy" : "falsy");
  console.log('stringState ? "truthy" : "falsy":', stringState ? "truthy" : "falsy");
  console.log('nullState ? "truthy" : "falsy":', nullState ? "truthy" : "falsy");
  console.log('undefinedState ? "truthy" : "falsy":', undefinedState ? "truthy" : "falsy");
  console.log();

  console.log('Comparison tests:');
  console.log('boolState === false:', boolState === false);
  console.log('numberState === 0:', numberState === 0);
  console.log('stringState === "":', stringState === "");
  console.log('nullState === null:', nullState === null);
  console.log('undefinedState === undefined:', undefinedState === undefined);
  console.log();

  console.log('valueOf() tests:');
  console.log('boolState.valueOf():', (boolState as any).valueOf());
  console.log('numberState.valueOf():', (numberState as any).valueOf());
  console.log('stringState.valueOf():', (stringState as any).valueOf());
  console.log('nullState.valueOf():', (nullState as any).valueOf());
  console.log('undefinedState.valueOf():', (undefinedState as any).valueOf());
  console.log();

  console.log('Testing if statement behavior:');
  if (boolState) {
    console.log('boolState is truthy in if statement');
  } else {
    console.log('boolState is falsy in if statement');
  }

  if (numberState) {
    console.log('numberState is truthy in if statement');
  } else {
    console.log('numberState is falsy in if statement');
  }

  if (stringState) {
    console.log('stringState is truthy in if statement');
  } else {
    console.log('stringState is falsy in if statement');
  }

  if (nullState) {
    console.log('nullState is truthy in if statement');
  } else {
    console.log('nullState is falsy in if statement');
  }

  if (undefinedState) {
    console.log('undefinedState is truthy in if statement');
  } else {
    console.log('undefinedState is falsy in if statement');
  }

  console.log();
  console.log('=== Testing Helper Functions ===');
  console.log('$truthy() tests with falsy values:');
  console.log('$truthy(boolState):', $truthy(boolState));
  console.log('$truthy(numberState):', $truthy(numberState));
  console.log('$truthy(stringState):', $truthy(stringState));
  console.log('$truthy(nullState):', $truthy(nullState));
  console.log('$truthy(undefinedState):', $truthy(undefinedState));

  console.log();
  console.log('$falsy() tests with falsy values:');
  console.log('$falsy(boolState):', $falsy(boolState));
  console.log('$falsy(numberState):', $falsy(numberState));
  console.log('$falsy(stringState):', $falsy(stringState));
  console.log('$falsy(nullState):', $falsy(nullState));
  console.log('$falsy(undefinedState):', $falsy(undefinedState));

  console.log();
  console.log('isTruthy() method tests:');
  console.log('boolState.isTruthy():', (boolState as any).isTruthy());
  console.log('numberState.isTruthy():', (numberState as any).isTruthy());
  console.log('stringState.isTruthy():', (stringState as any).isTruthy());
  console.log('nullState.isTruthy():', (nullState as any).isTruthy());
  console.log('undefinedState.isTruthy():', (undefinedState as any).isTruthy());

  console.log();
  console.log('Testing state updates:');
  setBoolState(true);
  setNumberState(42);
  setStringState("hello");
  setNullState({} as any); // Change to object instead of string
  setUndefinedState([] as any); // Change to array instead of string

  console.log('After setting truthy values:');
  console.log('$truthy(boolState):', $truthy(boolState));
  console.log('$truthy(numberState):', $truthy(numberState));
  console.log('$truthy(stringState):', $truthy(stringState));
  console.log('$truthy(nullState):', $truthy(nullState));
  console.log('$truthy(undefinedState):', $truthy(undefinedState));

  console.log();
  console.log('Setting back to falsy values:');
  setBoolState(false);
  setNumberState(0);
  setStringState("");
  setNullState(null);
  setUndefinedState(undefined);

  console.log('After setting falsy values again:');
  console.log('$truthy(boolState):', $truthy(boolState));
  console.log('$truthy(numberState):', $truthy(numberState));
  console.log('$truthy(stringState):', $truthy(stringState));
  console.log('$truthy(nullState):', $truthy(nullState));
  console.log('$truthy(undefinedState):', $truthy(undefinedState));
}

// Run the test
testStateBinder();
