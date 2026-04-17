import { Platform } from 'react-native';
import NativeSignalSeal from './NativeSignalSeal';
import { SignalSealError } from './errors';
import type {
  AttributionParams,
  ConfigureArgs,
  LogLevel,
  UserAttributes,
} from './types';
import { EventType } from './types';

export { EventType };
export { SignalSealError };
export type {
  AttributionParams,
  ConfigureArgs,
  LogLevel,
  UserAttributes,
  SignalSealErrorCode,
} from './types';

/**
 * Camel→snake rewrite table used by {@link setUserAttributes}. The
 * native SDKs already expect Meta-CAPI snake_case keys on the wire, so
 * we do the conversion here (rather than native) to keep the bridge a
 * pure marshalling layer.
 *
 * Only keys present in this table are forwarded. Passing an unknown
 * field to `setUserAttributes` is a no-op — callers that want to send
 * truly free-form attribution params should use `sendEvent` directly.
 */
const USER_ATTRIBUTE_KEY_MAP: Readonly<Record<keyof UserAttributes, string>> = Object.freeze({
  email: 'email',
  phone: 'phone',
  firstName: 'first_name',
  lastName: 'last_name',
  dob: 'dob',
  gender: 'gender',
  city: 'city',
  state: 'state',
  zip: 'zip',
  country: 'country',
  externalId: 'external_id',
});

const VALID_LOG_LEVELS: ReadonlySet<LogLevel> = new Set<LogLevel>([
  'off',
  'error',
  'warn',
  'info',
  'debug',
]);

/**
 * Set of string event types the native side recognises. Checked at the
 * TS boundary so callers passing a bare string (rather than the
 * `EventType` enum) still get validation without a round-trip to native.
 */
const VALID_EVENT_TYPE_VALUES: ReadonlySet<string> = new Set<string>(
  Object.values(EventType),
);

/**
 * Public facade for the SignalSeal RN bridge. Purely a validation +
 * delegation layer — every method forwards to the native TurboModule
 * after light argument checking. No attribution logic lives here.
 */
export const SignalSealSDK = {
  /**
   * Initialise the SDK. Safe to call multiple times; the native SDKs
   * treat the second call as a no-op. Validates args before crossing
   * the bridge so mistakes surface synchronously with a readable error.
   */
  configure(args: ConfigureArgs): void {
    if (!args || typeof args !== 'object') {
      throw new SignalSealError('CONFIGURE_FAILED', 'configure() requires an args object');
    }
    if (typeof args.apiKey !== 'string' || args.apiKey.length === 0) {
      throw new SignalSealError('INVALID_API_KEY', 'apiKey must be a non-empty string');
    }
    if (args.logLevel !== undefined && !VALID_LOG_LEVELS.has(args.logLevel)) {
      throw new SignalSealError(
        'INVALID_LOG_LEVEL',
        `logLevel must be one of: off | error | warn | info | debug (got "${String(args.logLevel)}")`,
      );
    }
    if (args.endpointBaseUrl !== undefined) {
      if (typeof args.endpointBaseUrl !== 'string' || args.endpointBaseUrl.length === 0) {
        throw new SignalSealError('INVALID_ENDPOINT', 'endpointBaseUrl must be a non-empty string when provided');
      }
    }

    // Build a minimal payload — we deliberately omit undefined fields so
    // the native layer sees `null`/absent rather than a string `"undefined"`.
    const payload: {
      apiKey: string;
      isDebug?: boolean;
      endpointBaseUrl?: string;
      logLevel?: string;
      customerUserId?: string;
    } = { apiKey: args.apiKey };
    if (args.isDebug !== undefined) payload.isDebug = !!args.isDebug;
    if (args.endpointBaseUrl !== undefined) payload.endpointBaseUrl = args.endpointBaseUrl;
    if (args.logLevel !== undefined) payload.logLevel = args.logLevel;
    if (args.customerUserId !== undefined && args.customerUserId !== null) {
      payload.customerUserId = String(args.customerUserId);
    }

    NativeSignalSeal.configure(payload);
  },

  /**
   * Fire an event. The `eventType` may be either an {@link EventType}
   * enum member or a bare string (useful for dynamic instrumentation
   * frameworks). Unknown string values are rejected client-side so the
   * error surfaces at the call site rather than as a silent native drop.
   *
   * The underlying native API is fire-and-forget; this method does not
   * return a promise. Use {@link flush} if you need to force delivery.
   */
  sendEvent(
    eventType: EventType | string,
    parameters?: Record<string, unknown>,
    name?: string,
  ): void {
    const typeStr = typeof eventType === 'string' ? eventType : String(eventType);
    if (!VALID_EVENT_TYPE_VALUES.has(typeStr)) {
      throw new SignalSealError(
        'INVALID_EVENT_TYPE',
        `Unknown event type "${typeStr}". Use EventType enum or a matching UPPER_SNAKE string.`,
      );
    }
    NativeSignalSeal.sendEvent(typeStr, name, parameters);
  },

  /**
   * Attach PII / identity attributes to this installation. Fields are
   * rewritten from camelCase to the snake_case keys the native SDKs
   * forward verbatim to the server. All-null / empty input is a no-op;
   * empty string values are preserved as-is (the native SDKs treat
   * them the same as any other value — callers that want to "clear"
   * should use a separate API, which doesn't exist yet).
   */
  setUserAttributes(attrs: UserAttributes): void {
    if (!attrs || typeof attrs !== 'object') {
      throw new SignalSealError('CONFIGURE_FAILED', 'setUserAttributes requires an object');
    }
    const wire: Record<string, unknown> = {};
    for (const key of Object.keys(USER_ATTRIBUTE_KEY_MAP) as Array<keyof UserAttributes>) {
      const value = attrs[key];
      if (value === undefined || value === null) continue;
      const wireKey = USER_ATTRIBUTE_KEY_MAP[key];
      wire[wireKey] = value;
    }
    if (Object.keys(wire).length === 0) {
      // Matches the native short-circuit: an empty attribute bag does
      // nothing on either SDK, so we skip the bridge hop entirely.
      return;
    }
    NativeSignalSeal.setUserAttributes(wire);
  },

  /**
   * Force-flush the in-memory event queue. Resolves once the native
   * queue has been drained (iOS) / scheduled for drain (Android).
   */
  async flush(): Promise<void> {
    try {
      await NativeSignalSeal.flush();
    } catch (err) {
      throw SignalSealError.from(err);
    }
  },

  /**
   * Returns the persistent SignalSeal ID. `null` when the SDK hasn't
   * finished configuring or has been disabled. (Internally this value
   * is the `installation_id` — keep that spelling in wire payloads and
   * DB columns; customers see "SignalSeal ID".)
   */
  async getSignalSealId(): Promise<string | null> {
    try {
      return await NativeSignalSeal.getSignalSealId();
    } catch (err) {
      throw SignalSealError.from(err);
    }
  },

  /**
   * Returns the current attribution parameters (deeplink id, gclid,
   * utm_* values, etc.) or `null` if no match has resolved yet. On iOS
   * this awaits an internal attribution gate (bounded by the match
   * timeout); on Android it returns cached values synchronously.
   */
  async getAttributionParams(): Promise<AttributionParams | null> {
    try {
      const result = await NativeSignalSeal.getAttributionParams();
      if (!result) return null;
      // Coerce everything to string — iOS returns mixed `Any` values
      // (timestamps, install_id) that cross the bridge as `NSNumber`s,
      // and a uniform `Record<string, string>` is friendlier on JS.
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(result)) {
        out[k] = typeof v === 'string' ? v : String(v);
      }
      return out;
    } catch (err) {
      throw SignalSealError.from(err);
    }
  },

  /**
   * True if the SDK has permanently disabled itself (e.g. API key
   * rejected on auth). Subsequent calls to `sendEvent` / `flush` are
   * no-ops until a fresh `configure` with a new key.
   */
  async isSdkDisabled(): Promise<boolean> {
    try {
      return await NativeSignalSeal.isSdkDisabled();
    } catch (err) {
      throw SignalSealError.from(err);
    }
  },

  /**
   * iOS-only. Starts the Apple Search Ads attribution flow via
   * `SignalSealASAAttribution.shared`. No-op on Android.
   */
  enableAppleAdsAttribution(): void {
    if (Platform.OS !== 'ios') return;
    NativeSignalSeal.enableAppleAdsAttribution();
  },

  /**
   * iOS-only. Enables automatic StoreKit 2 purchase tracking. Deliberately
   * decoupled from {@link enableAppleAdsAttribution}. No-op on Android
   * (Play Billing tracking isn't part of the 0.0.1 surface).
   */
  enablePurchaseTracking(): void {
    if (Platform.OS !== 'ios') return;
    NativeSignalSeal.enablePurchaseTracking();
  },
};

export default SignalSealSDK;
