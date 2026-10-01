/**
 * PostFlow Structured Production Logger
 * Provides sanitized, audit-friendly structured logging without leaking sensitive OAuth
 * credentials, access tokens, refresh tokens, or passwords.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
  error?: {
    name?: string;
    message: string;
    stack?: string;
  };
}

const SENSITIVE_KEYS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'client_secret',
  'client_id',
  'partner_key',
  'password',
  'authorization',
  'cookie',
  'secret',
  'credentials',
  'code_verifier',
]);

/**
 * Recursively redacts sensitive keys from log metadata to prevent credential leakage.
 */
export function sanitizeLogData(data: unknown, seen = new WeakSet()): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  // Handle circular references safely
  if (seen.has(data as object)) {
    return '[Circular Reference]';
  }
  seen.add(data as object);

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, seen));
  }

  if (data instanceof Error) {
    return {
      name: data.name,
      message: data.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : data.stack,
    };
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = Array.from(SENSITIVE_KEYS).some(
      (sensitive) => lowerKey === sensitive || lowerKey.includes(sensitive)
    );

    if (isSensitive && typeof val === 'string' && val.length > 0) {
      sanitized[key] = `[REDACTED_LEN_${val.length}]`;
    } else {
      sanitized[key] = sanitizeLogData(val, seen);
    }
  }

  return sanitized;
}

class Logger {
  private formatEntry(
    level: LogLevel,
    message: string,
    context?: string,
    meta?: Record<string, unknown>,
    err?: unknown
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (context) {
      entry.context = context;
    }

    if (meta) {
      entry.data = sanitizeLogData(meta) as Record<string, unknown>;
    }

    if (err) {
      if (err instanceof Error) {
        entry.error = {
          name: err.name,
          message: err.message,
          stack: err.stack,
        };
      } else {
        entry.error = {
          message: String(err),
        };
      }
    }

    return entry;
  }

  public debug(message: string, meta?: Record<string, unknown>, context?: string): void {
    if (process.env.NODE_ENV === 'development') {
      const entry = this.formatEntry('debug', message, context, meta);
      console.debug(JSON.stringify(entry));
    }
  }

  public info(message: string, meta?: Record<string, unknown>, context?: string): void {
    const entry = this.formatEntry('info', message, context, meta);
    console.info(JSON.stringify(entry));
  }

  public warn(message: string, meta?: Record<string, unknown>, context?: string): void {
    const entry = this.formatEntry('warn', message, context, meta);
    console.warn(JSON.stringify(entry));
  }

  public error(
    message: string,
    err?: unknown,
    meta?: Record<string, unknown>,
    context?: string
  ): void {
    const entry = this.formatEntry('error', message, context, meta, err);
    console.error(JSON.stringify(entry));
  }
}

export const logger = new Logger();
