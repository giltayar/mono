/**
 * @template T
 * @typedef Functionify
 * @type {{ [K in keyof T]: () => T[K] }}
 */
/**
 * @template T
 * @param {(f: Parameters<import('mocha').Func>) => T} f
 * @returns {T extends Promise<any> ? Functionify<import('type-fest').PromiseValue<T>> : Functionify<T>}
 */
export function before<T>(f: (f: Parameters<import('mocha').Func>) => T): T extends Promise<any> ? Functionify<import("type-fest").PromiseValue<T, T>> : Functionify<T>;
/**
 * @template T
 * @param {(f: Parameters<import('mocha').Func>) => T} f
 * @returns {T extends Promise<any> ? Functionify<import('type-fest').PromiseValue<T>> : Functionify<T>}
 */
export function beforeEach<T>(f: (f: Parameters<import('mocha').Func>) => T): T extends Promise<any> ? Functionify<import("type-fest").PromiseValue<T, T>> : Functionify<T>;
export const describe: mocha.SuiteFunction;
export const it: mocha.TestFunction;
export const after: mocha.HookFunction;
export const afterEach: mocha.HookFunction;
export type Functionify<T> = { [K in keyof T]: () => T[K]; };
import mocha from "mocha";
//# sourceMappingURL=mocha-commons.d.ts.map