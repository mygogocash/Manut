/**
 * Test-only assertion helpers for assumptions that TypeScript cannot prove.
 *
 * Keeping these checks at runtime makes fixture drift fail at the point where
 * the test reads the value, instead of hiding the assumption with `!`.
 */
export function assertDefined<T>(
  value: T,
  label = "expected value",
): NonNullable<T> {
  if (value === undefined || value === null) {
    throw new Error(`${label} was not defined`);
  }

  return value;
}

export function arrayAt<T>(
  values: readonly T[],
  index: number,
  label = "array item",
): T {
  return assertDefined(values[index], `${label} at index ${index}`);
}

export function findOrThrow<T>(
  values: readonly T[],
  predicate: (value: T, index: number, values: readonly T[]) => boolean,
  label = "matching array item",
): T {
  return assertDefined(values.find(predicate), label);
}

export function mockCall<Args extends readonly unknown[]>(
  calls: readonly Args[],
  callIndex = 0,
  label = "mock call",
): Args {
  return arrayAt(calls, callIndex, label);
}

export function mockArgument<
  Args extends readonly unknown[],
  Index extends number,
>(
  calls: readonly Args[],
  callIndex: number,
  argumentIndex: Index,
  label = "mock argument",
): NonNullable<Args[Index]> {
  const call = mockCall(calls, callIndex, label);
  return assertDefined(
    call[argumentIndex],
    `${label} ${argumentIndex} in call ${callIndex}`,
  );
}

/**
 * Access test-only environment values without declaring credentials as Turbo
 * task inputs. Test processes remain isolated and restore values explicitly.
 */
export function getTestEnv(name: string): string | undefined {
  return process.env[name];
}

export function setTestEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
