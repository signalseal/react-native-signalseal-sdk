import type { SignalSealErrorCode } from './types';

/**
 * Thrown by the TS facade on argument validation failures, and by the
 * async methods when the native side rejects a promise.
 *
 * Native rejections arrive as plain `Error` objects with a `.code` field
 * (RN convention: `reject("INVALID_API_KEY", "message", nil)` on iOS,
 * `promise.reject("INVALID_API_KEY", message)` on Android). We wrap
 * those into a `SignalSealError` so callers can `instanceof`-check one
 * class across both sources.
 */
export class SignalSealError extends Error {
  public readonly code: SignalSealErrorCode;
  public readonly nativeStack?: string;

  constructor(code: SignalSealErrorCode, message: string, nativeStack?: string) {
    super(message);
    this.name = 'SignalSealError';
    this.code = code;
    this.nativeStack = nativeStack;
    // Preserve prototype chain under ES5 downlevel targets.
    Object.setPrototypeOf(this, SignalSealError.prototype);
  }

  /**
   * Lift an unknown thrown value (typically a rejection from the RN
   * bridge) into a `SignalSealError`. Unknown codes fall back to
   * `NATIVE_ERROR` so the caller always gets a stable union type.
   */
  static from(err: unknown, fallbackCode: SignalSealErrorCode = 'NATIVE_ERROR'): SignalSealError {
    if (err instanceof SignalSealError) return err;
    if (err && typeof err === 'object') {
      const anyErr = err as { code?: unknown; message?: unknown; stack?: unknown };
      const code = typeof anyErr.code === 'string' ? (anyErr.code as SignalSealErrorCode) : fallbackCode;
      const message = typeof anyErr.message === 'string' ? anyErr.message : String(err);
      const stack = typeof anyErr.stack === 'string' ? anyErr.stack : undefined;
      return new SignalSealError(code, message, stack);
    }
    return new SignalSealError(fallbackCode, String(err));
  }
}
