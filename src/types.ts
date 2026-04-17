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
 * Shape returned by {@link SignalSealSDK.getAttributionParams}.
 *
 * iOS returns a broader set (deeplink_id, gclid, install_id, method, url,
 * timestamp, event_type, redirection_url) as `Record<string, any>`;
 * Android returns a flat `Record<string, string>`. We type the JS surface
 * as `Record<string, string>` to stay portable — values are coerced to
 * strings at the native boundary where needed.
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
  | 'CONFIGURE_FAILED'
  | 'EVENT_SEND_ERROR'
  | 'NATIVE_ERROR'
  | 'PLATFORM_NOT_SUPPORTED';
