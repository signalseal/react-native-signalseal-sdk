import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';

/**
 * TurboModule Spec for the SignalSeal native bridge.
 *
 * Codegen reads this file (see `codegenConfig` in `package.json`) when
 * the host app builds with the new architecture enabled. The same
 * interface shape is used at runtime by the old-architecture fallback
 * below so we never maintain two type contracts.
 *
 * Method conventions:
 *   - Fire-and-forget methods return `void` on JS but still hit native
 *     on a worker queue (RN auto-dispatches `RCT_EXPORT_METHOD` /
 *     `@ReactMethod` off the JS thread).
 *   - Methods returning a result use `Promise<T>`; native resolves or
 *     rejects with a code+message the TS facade wraps into
 *     `SignalSealError`.
 *
 * On the RN side we only speak plain JSON-encodable primitives. Enums
 * and typed structs cross the boundary as strings and `Object` maps.
 */
export interface Spec extends TurboModule {
  configure(args: {
    apiKey: string;
    isDebug?: boolean;
    endpointBaseUrl?: string;
    logLevel?: string;
    customerUserId?: string;
  }): void;

  sendEvent(eventType: string, name?: string, parameters?: { [key: string]: unknown }): void;
  setUserAttributes(attrs: { [key: string]: unknown }): void;
  flush(): Promise<void>;
  getSignalSealId(): Promise<string | null>;
  getAttributionParams(): Promise<{ [key: string]: string } | null>;
  isSdkDisabled(): Promise<boolean>;
  enableAppleAdsAttribution(): void;
  enablePurchaseTracking(): void;
}

/**
 * Module name registered by both native platforms:
 *   iOS:     `RCT_EXPORT_MODULE(SignalSealReactNative)`
 *   Android: `override fun getName() = "SignalSealReactNative"`
 */
const MODULE_NAME = 'SignalSealReactNative';

/**
 * Prefer the TurboModule registry (new architecture). `getEnforcing`
 * throws if the module isn't registered — on the old architecture it
 * isn't, and the registry lookup itself may be absent on older RN
 * versions. Fall back to the classic `NativeModules` lookup so the
 * bridge works on `react-native >= 0.71` regardless of arch setting.
 *
 * Using `getEnforcing` (vs. `get`) is deliberate: on new-arch apps we
 * want a loud failure at boot if codegen didn't wire up the spec,
 * rather than silent undefined-method crashes on first call.
 */
let nativeSpec: Spec;
try {
  // `TurboModuleRegistry` is guaranteed on RN 0.68+, but `getEnforcing`
  // only succeeds when the new architecture is actually on.
  nativeSpec = TurboModuleRegistry.getEnforcing<Spec>(MODULE_NAME);
} catch {
  const fallback = (NativeModules as Record<string, unknown>)[MODULE_NAME] as Spec | undefined;
  if (!fallback) {
    // Deferred error: import-time throws would break any code path that
    // imports this module without ever calling it (e.g. tests with a
    // `jest.mock` that hasn't been set up yet). Surface the failure on
    // first native method invocation instead.
    nativeSpec = new Proxy({} as Spec, {
      get() {
        throw new Error(
          `[SignalSeal] Native module "${MODULE_NAME}" is not linked. ` +
            `On iOS, run \`cd ios && pod install\`. ` +
            `On Android, ensure SignalSealReactNativePackage is registered and the library is included in settings.gradle.`,
        );
      },
    });
  } else {
    nativeSpec = fallback;
  }
}

export default nativeSpec;
