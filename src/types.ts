/**
 * Canonical event types — string values match the UPPER_SNAKE wire format
 * expected by the ingestion backend (and the enum raw values on both
 * native SDKs: `EventType.rawValue` on iOS, `EventType.name` on Android).
 */
export enum EventType {
  Install = 'INSTALL',
  Login = 'LOGIN',
  SignUp = 'SIGN_UP',
  Register = 'REGISTER',
  Purchase = 'PURCHASE',
  AddToCart = 'ADD_TO_CART',
  AddToWishlist = 'ADD_TO_WISHLIST',
  InitiateCheckout = 'INITIATE_CHECKOUT',
  StartTrial = 'START_TRIAL',
  Subscribe = 'SUBSCRIBE',
  LevelStart = 'LEVEL_START',
  LevelComplete = 'LEVEL_COMPLETE',
  TutorialComplete = 'TUTORIAL_COMPLETE',
  Search = 'SEARCH',
  ViewItem = 'VIEW_ITEM',
  ViewContent = 'VIEW_CONTENT',
  Share = 'SHARE',
  Custom = 'CUSTOM',
}

/**
 * String log levels. Mirrors both native SDKs' verbosity ordering:
 * `off < error < warn < info < debug`.
 */
export type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug';

/**
 * Build environment override for {@link ConfigureArgs.environment}.
 * Values match the wire format the server expects.
 *
 * Both native SDKs auto-detect (iOS: simulator + debugger + receipt
 * URL; Android: FLAG_DEBUGGABLE + emulator heuristics). Pass this
 * value to `configure()` only when the auto-detection misses your
 * build context — typically:
 *   - iOS: ad-hoc / enterprise / custom QA distributions
 *   - Android: Google Play internal/closed/open testing tracks
 *     (release builds with `debuggable=false` shipped via Play Console)
 */
export type Environment = 'production' | 'sandbox';

/**
 * Arguments accepted by {@link SignalSealSDK.configure}. All
 * fields except `apiKey` are optional — the native SDKs own the defaults
 * (endpoint, log level, debug). The bridge does NOT hardcode defaults.
 */
export interface ConfigureArgs {
  /** `ak_ios_<ulid>` or `ak_android_<ulid>` from the SignalSeal dashboard. */
  apiKey: string;
  /** When true, both SDKs route events to the test silo and verbosely log. */
  isDebug?: boolean;
  /**
   * Override the ingestion origin. Must end with a trailing slash, e.g.
   * `https://events.example.com/v1/ios/`. When `undefined`, the native
   * SDK's built-in default is used.
   */
  endpointBaseUrl?: string;
  /** `'info'` by default. `isDebug: true` forces `'debug'` on iOS. */
  logLevel?: LogLevel;
  /** Stable host-app user id. Recommended for multi-device identity. */
  customerUserId?: string;
  /**
   * Override the auto-detected build environment. Leave unset and the
   * native SDKs will infer it. See {@link Environment} for when to
   * pass this explicitly.
   */
  environment?: Environment;
}

/**
 * PII / identity attributes matching the Meta-CAPI key schema. All fields
 * are optional; null / undefined fields are dropped client-side before
 * crossing the native bridge so the server never sees empty strings that
 * would clobber hashed values.
 *
 * Keys on the wire are snake_case (`first_name`, `external_id`); the
 * camelCase → snake_case rewrite happens in the TS facade.
 */
export interface UserAttributes {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  /** ISO-8601 date, `YYYY-MM-DD`. */
  dob?: string;
  /** Free-form; commonly `'m'` / `'f'`. */
  gender?: string;
  city?: string;
  state?: string;
  zip?: string;
  /** ISO-3166-1 alpha-2 country code, e.g. `'US'`. */
  country?: string;
  /** Host-app's internal user identifier (post-login). */
  externalId?: string;
}

/**
 * Shape returned by {@link SignalSealSDK.getAttributionParams}. Flat
 * string→string map mixing normalized `signalseal_*` keys with raw
 * ad-network click IDs. See the method docstring for the full key list.
 *
 * Values cross the native bridge and are coerced to string in the TS
 * facade — iOS internally returns `Any` (NSNumber for timestamps) and
 * Android returns `String` directly; stringification here keeps the JS
 * surface portable.
 */
export type AttributionParams = Record<string, string>;

/**
 * Error codes thrown by the TS facade on pre-flight validation, or
 * returned from native on rejection.
 */
export type SignalSealErrorCode =
  | 'INVALID_API_KEY'
  | 'INVALID_LOG_LEVEL'
  | 'INVALID_ENDPOINT'
  | 'INVALID_EVENT_TYPE'
  | 'INVALID_ENVIRONMENT'
  | 'CONFIGURE_FAILED'
  | 'EVENT_SEND_ERROR'
  | 'NATIVE_ERROR'
  | 'PLATFORM_NOT_SUPPORTED';
