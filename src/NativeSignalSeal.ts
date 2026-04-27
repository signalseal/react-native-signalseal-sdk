import type { TurboModule } from 'react-native';
import { NativeModules, TurboModuleRegistry } from 'react-native';

/**
 * TurboModule spec for the SignalSeal native bridge. RN codegen reads
 * this file (driven by `codegenConfig.name = "NativeSignalSealSpec"`
 * in `package.json`) to produce:
 *   - Android: an abstract `NativeSignalSealSpec` Java class that the
 *     Kotlin module extends. The base class itself extends
 *     `ReactContextBaseJavaModule` and implements `TurboModule`, so the
 *     same module class works on both architectures.
 *   - iOS: a `<NativeSignalSealSpec>` Obj-C protocol and a
 *     `NativeSignalSealSpecJSI` C++ wrapper. The .mm conditionally
 *     conforms to the protocol on `RCT_NEW_ARCH_ENABLED` builds and
 *     returns the JSI wrapper from `getTurboModule:`.
 *
 * Method conventions:
 *   - Fire-and-forget methods return `void` on JS but still hit native
 *     on a worker queue. Exceptions surface as JS console errors.
 *   - Methods returning a result use `Promise<T>`. Native rejects with
 *     a `code + message` that the TS facade in `index.ts` rewraps into
 *     `SignalSealError`.
 *
 * Object args use index-signature `{ [key: string]: unknown }` rather
 * than inline named-property types because codegen lowers index
 * signatures to `NSDictionary *` / `ReadableMap` (loose), whereas
 * inline named-property types lower to typed C++ structs on iOS — the
 * bridge would then need to unpack those, which buys us nothing here
 * since the JS facade already validates shapes.
 */
export interface Spec extends TurboModule {
  // NOTE: object args are typed loosely as index-signature maps so RN
  // codegen emits `NSDictionary *` on iOS (and `ReadableMap` on Android)
  // for the bridge boundary. Strict shape validation lives in the TS
  // facade (`src/index.ts`) and the native code, not at the spec.
  // Inline object types with named properties would force codegen to
  // generate typed C++ structs on iOS, breaking the dictionary-based
  // implementations.
  configure(args: { [key: string]: unknown }): void;

  sendEvent(eventType: string, name?: string, parameters?: { [key: string]: unknown }): void;
  setUserAttributes(attrs: { [key: string]: unknown }): void;
  flush(): Promise<void>;
  resetData(): void;
  getSignalSealId(): Promise<string | null>;
  getAttributionParams(): Promise<{ [key: string]: string } | null>;
  isSdkDisabled(): Promise<boolean>;
  enableAppleAdsAttribution(): void;
  enablePurchaseTracking(): void;
}

/**
 * Module name registered by both native platforms:
 *   iOS:     `RCT_EXPORT_MODULE(SignalSealReactNative)`
 *   Android: `companion object { const val NAME = "SignalSealReactNative" }`
 *
 * Codegen's spec parser requires the name in `getEnforcing(...)` to
 * appear as a string LITERAL — it won't resolve a `const` identifier
 * even when declared in the same file. Keep the literal inline below
 * and reuse this constant only for the old-arch `NativeModules`
 * fallback path.
 */
const MODULE_NAME = 'SignalSealReactNative';

/**
 * On the new architecture, `TurboModuleRegistry.getEnforcing` returns
 * the codegen-backed JSI module directly. On the old architecture it
 * throws (the registry exists but no TurboModule is registered under
 * this name); we fall back to the classic `NativeModules` lookup,
 * which the autolinked `SignalSealReactNativePackage` populates.
 *
 * `getEnforcing` (vs. `get`) is deliberate: on new-arch builds we
 * want a loud failure at boot if codegen didn't wire up the spec,
 * rather than silent undefined-method crashes on first call. The
 * `try/catch` containment makes this safe in old-arch + test
 * environments where the throw is expected.
 */
let nativeSpec: Spec;
try {
  // Codegen requires the spec name as a string literal here.
  nativeSpec = TurboModuleRegistry.getEnforcing<Spec>('SignalSealReactNative');
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
