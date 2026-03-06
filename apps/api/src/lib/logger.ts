export interface LogEntry {
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    traceId?: string;
    tenantId?: string;
    userId?: string;
    method?: string;
    url?: string;
    statusCode?: number;
    durationMs?: number;
    error?: string;
    stack?: string;
    [key: string]: unknown;
}

function log(entry: LogEntry): void {
    const output = {
        timestamp: new Date().toISOString(),
        ...entry,
    };

    if (entry.level === 'error') {
        console.error(JSON.stringify(output));
    } else {
        console.log(JSON.stringify(output));
    }
}

export const logger = {
    info: (message: string, meta?: Omit<LogEntry, 'level' | 'message'>) =>
        log({ level: 'info', message, ...meta }),
    warn: (message: string, meta?: Omit<LogEntry, 'level' | 'message'>) =>
        log({ level: 'warn', message, ...meta }),
    error: (message: string, meta?: Omit<LogEntry, 'level' | 'message'>) =>
        log({ level: 'error', message, ...meta }),
    debug: (message: string, meta?: Omit<LogEntry, 'level' | 'message'>) =>
        log({ level: 'debug', message, ...meta }),
};
