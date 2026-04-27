# @signalseal/react-native

React Native bridge for the SignalSeal attribution SDKs. This package is a thin marshalling layer — all attribution logic lives in the native iOS and Android SDKs.

## Install

```bash
npm install @signalseal/react-native
# or
yarn add @signalseal/react-native
```

**iOS:**

```bash
cd ios && pod install
```

**Android:**

Autolinking handles it. The bridge transitively pulls in `io.github.signalseal:signalseal-android-sdk`.

## Usage

```ts
import { SignalSealSDK, EventType } from '@signalseal/react-native';

SignalSealSDK.configure({
  apiKey: 'ak_ios_01J...', // or ak_android_*
  isDebug: __DEV__,
  logLevel: 'info',
});

SignalSealSDK.sendEvent(EventType.Purchase, {
  revenue: 9.99,
  currency: 'USD',
});

SignalSealSDK.setUserAttributes({
  email: 'user@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
});

const signalSealId = await SignalSealSDK.getSignalSealId();
const attribution = await SignalSealSDK.getAttributionParams();
```

## API

| Method | Returns | Platforms |
| --- | --- | --- |
| `configure(args)` | `void` | iOS, Android |
| `sendEvent(type, params?, name?)` | `void` | iOS, Android |
| `setUserAttributes(attrs)` | `void` | iOS, Android |
| `flush()` | `Promise<void>` | iOS, Android |
| `getSignalSealId()` | `Promise<string \| null>` | iOS, Android |
| `getAttributionParams()` | `Promise<Record<string, string> \| null>` | iOS, Android |
| `isSdkDisabled()` | `Promise<boolean>` | iOS, Android |
| `enableAppleAdsAttribution()` | `void` | iOS only (Android no-op) |
| `enablePurchaseTracking()` | `void` | iOS only (Android no-op) |

## Requirements

- React Native **0.71+**
- iOS **15.0+**
- Android **API 21+**

## Architecture

This package supports both the legacy and new React Native architectures. The TurboModule spec lives at `src/NativeSignalSeal.ts`; `TurboModuleRegistry.getEnforcing` is used on new-arch builds with a `NativeModules` fallback for legacy.

## Releasing (maintainers)

When cutting a new version of this package, three things must move together — forgetting any of them ships a broken release:

1. **`package.json#version`** — the npm version users install.
2. **`android/build.gradle`** → `api 'io.github.signalseal:signalseal-android-sdk:X.Y.Z'` — must reference an Android SDK version that has every native symbol the RN bridge code references. If the bridge starts calling a new SDK API (e.g. `SignalSealEnvironment`, a new `configure()` parameter), the Android SDK on Maven Central must already have it. **Publish the Android SDK first**, then bump this gradle line.
3. **`ios/SignalSealAttributionSDK.xcframework/`** — the vendored iOS framework (22 tracked files). Rebuild via `cd ../ios-signalseal-core-sdk && ./scripts/build-xcframework.sh` (which auto-vendors a fresh copy here). Same lockstep rule: the rebuilt xcframework must come from a core-SDK commit that has the symbols the bridge references.

A green TS typecheck does not catch these — they're runtime / native-link errors only. The cheapest sanity check before `npm publish` is to actually `npm install` the candidate locally in a host app and run `pod install` + `./gradlew assembleDebug` once.

## License

MIT
