/**
 * @typedef {{
 *  originals: {
 *    log: any
 *    error: any
 *  }
 *  logOutput: string[]
 * }} ConsoleCapturer
 */
/**
 *
 * @param {{silent?: boolean}} options
 */
export function captureConsole({ silent }?: {
    silent?: boolean;
}): ConsoleCapturer;
/**
 *
 * @param {{consoleCapturer: ConsoleCapturer}} options
 */
export function consoleOutputAsString({ consoleCapturer }: {
    consoleCapturer: ConsoleCapturer;
}): string;
/**
 *
 * @param {{consoleCapturer: ConsoleCapturer}} options
 */
export function uncaptureConsole({ consoleCapturer }: {
    consoleCapturer: ConsoleCapturer;
}): void;
/**
 *
 * @param {(f: () => void) => void} before
 * @param {(f: () => void) => void} after
 * @param {{silent?: boolean}} [options]
 */
export function captureConsoleInTest(before: (f: () => void) => void, after: (f: () => void) => void, { silent }?: {
    silent?: boolean | undefined;
} | undefined): {
    consoleOutputAsString: ({ isLastTime }?: {
        isLastTime?: boolean | undefined;
    }) => string;
    uncaptureConsole: () => void;
};
export type ConsoleCapturer = {
    originals: {
        log: any;
        error: any;
    };
    logOutput: string[];
};
//# sourceMappingURL=console-tesktit.d.ts.map