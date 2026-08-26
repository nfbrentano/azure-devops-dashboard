/**
 * Environment-aware logging utility for Azure DevOps Dashboard.
 * Logs are enabled in development mode or when localStorage 'debug' is set to 'true'.
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const isDev =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('debug') === 'true');

function formatPrefix(level: LogLevel, module?: string): string {
    const mod = module ? `[${module}]` : '';
    return `[${level}]${mod}`;
}

function createLogger(moduleName?: string) {
    return {
        debug(...args: unknown[]) {
            if (isDev) {
                console.log(formatPrefix('DEBUG', moduleName), ...args);
            }
        },
        info(...args: unknown[]) {
            if (isDev) {
                console.info(formatPrefix('INFO', moduleName), ...args);
            }
        },
        warn(...args: unknown[]) {
            console.warn(formatPrefix('WARN', moduleName), ...args);
        },
        error(...args: unknown[]) {
            console.error(formatPrefix('ERROR', moduleName), ...args);
        },
        forModule(name: string) {
            return createLogger(name);
        }
    };
}

export const logger = createLogger();

