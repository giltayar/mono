/**
 * @param {number} ms
 * @param {() => any} errFactory
 *
 * @returns {Promise<void>}
 */
export function failAfter(ms: number, errFactory: () => any): Promise<void>;
/**
 * @template T
 * @template TErr
 * @param {Promise<T>} promise
 *
 * @returns {Promise<[err: TErr|undefined, value: T|undefined]>}
 */
export function presult<T, TErr>(promise: Promise<T>): Promise<[err: TErr | undefined, value: T | undefined]>;
/**
 * @template T
 * @template TErr
 * @param {Promise<[err: TErr|undefined, value: T|undefined]>} presultPromise
 *
 * @returns {Promise<T | Promise<never>>}
 */
export function unwrapPresult<T, TErr>(presultPromise: Promise<[err: TErr | undefined, value: T | undefined]>): Promise<T | Promise<never>>;
/**
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function delay(ms: number): Promise<void>;
/**
 * @template T, V
 * @param {Promise<T>|((abortSignal: AbortSignal) => Promise<T>)} promiseOrPromiseFunc
 * @param {number} timeout
 * @param {V} value
 * @returns {Promise<T|V>}
 */
export function ptimeoutWithValue<T, V>(promiseOrPromiseFunc: Promise<T> | ((abortSignal: AbortSignal) => Promise<T>), timeout: number, value: V): Promise<T | V>;
/**
 * @template T
 * @template TErr
 * @param {Promise<T>|((abortSignal: AbortSignal) => Promise<T>)} promiseOrPromiseFunc
 * @param {number} timeout
 * @param {TErr} error
 * @returns {Promise<T|never>}
 */
export function ptimeoutWithError<T, TErr>(promiseOrPromiseFunc: Promise<T> | ((abortSignal: AbortSignal) => Promise<T>), timeout: number, error: TErr): Promise<T>;
/**
 * @template T, V
 * @param {Promise<T>|((abortSignal: AbortSignal) => Promise<T>)} promiseOrPromiseFunc
 * @param {number} timeout
 * @param {() => Promise<V>} func
 * @returns {Promise<T|V>}
 */
export function ptimeoutWithFunction<T, V>(promiseOrPromiseFunc: Promise<T> | ((abortSignal: AbortSignal) => Promise<T>), timeout: number, func: () => Promise<V>): Promise<T | V>;
/**
 * @template T
 * @returns {Promise<T>}
 */
export function makeResolveablePromise<T>(): Promise<T>;
/**
 * @template T
 * @param {Promise<T>} promise
 * @param {T} value
 * @returns {void}
 */
export function resolveResolveablePromise<T>(promise: Promise<T>, value: T): void;
/**
 * @template T
 * @param {Promise<T>} promise
 * @param {Error} err
 * @returns {void}
 */
export function rejectResolveablePromise<T>(promise: Promise<T>, err: Error): void;
//# sourceMappingURL=promise-commons.d.ts.map