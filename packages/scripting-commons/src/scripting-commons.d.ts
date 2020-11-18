/**
 * @param {string} command
 * @param {{
 * cwd: string
 * env?: object|undefined
 * }} params
 */
export function sh(command: string, { cwd, env }: {
    cwd: string;
    env?: object | undefined;
}): Promise<void>;
/**
 * @param {string} command
 * @param {{
 * cwd: string
 * env?: object|undefined
 * }} params
 */
export function shWithOutput(command: string, { cwd, env }: {
    cwd: string;
    env?: object | undefined;
}): Promise<string>;
/**
 * @param {string | string[]} file
 * @param {Buffer|string|object} content
 * @param {{cwd: string}} options
 * @returns {Promise<void>}
 */
export function writeFile(file: string | string[], content: Buffer | string | object, { cwd }: {
    cwd: string;
}): Promise<void>;
/**
 * @param {string | string[]} file
 * @param {{cwd: string}} options
 * @returns {Promise<string>}
 */
export function readFileAsString(file: string | string[], { cwd }: {
    cwd: string;
}): Promise<string>;
/**
 * @param {string | string[]} file
 * @param {{cwd: string}} options
 * @returns {Promise<object>}
 */
export function readFileAsJson(file: string | string[], { cwd }: {
    cwd: string;
}): Promise<object>;
/**
 * @returns {Promise<string>}
 */
export function makeTemporaryDirectory(): Promise<string>;
//# sourceMappingURL=scripting-commons.d.ts.map