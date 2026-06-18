/**
 * Environment-aware logging utility for Azure DevOps Dashboard.
 * Logs are enabled in development mode or when localStorage 'debug' is set to 'true'.
 */
const isDev = 
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) || 
    (typeof localStorage !== 'undefined' && localStorage.getItem('debug') === 'true');

export const logger = {
    debug(...args: unknown[]) {
        if (isDev) {
            console.log('[DEBUG]', ...args);
        }
    },
    info(...args: unknown[]) {
        if (isDev) {
            console.info('[INFO]', ...args);
        }
    },
    warn(...args: unknown[]) {
        console.warn('[WARN]', ...args);
    },
    error(...args: unknown[]) {
        console.error('[ERROR]', ...args);
    }
};
