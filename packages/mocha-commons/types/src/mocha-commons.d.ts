/// <reference types="mocha" />
/**
 * @template T
 * @typedef Functionify
 * @type {{ [K in keyof T]: () => T[K] }}
 */
/**
 * @template T
 * @param {(f: Parameters<import('mocha').Func>) => T} f
 * @returns {T extends Promise<any> ? Functionify<Awaited<T>> : Functionify<T>}
 */
export function before<T>(f: (f: Parameters<import('mocha').Func>) => T): T extends Promise<any> ? Functionify<Awaited<T>> : Functionify<T>;
/**
 * @template T
 * @param {(f: Parameters<import('mocha').Func>) => T} f
 * @returns {T extends Promise<any> ? Functionify<Awaited<T>> : Functionify<T>}
 */
export function beforeEach<T>(f: (f: Parameters<import('mocha').Func>) => T): T extends Promise<any> ? Functionify<Awaited<T>> : Functionify<T>;
export const describe: Mocha.SuiteFunction;
export const it: Mocha.TestFunction;
export const after: Mocha.HookFunction;
export const afterEach: Mocha.HookFunction;
export type Functionify<T> = { [K in keyof T]: () => T[K]; };
//# sourceMappingURL=mocha-commons.d.ts.map