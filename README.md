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

Autolinking handles it. The bridge transitively pulls in `dev.signalseal:signalseal-android-sdk`.

## Usage

```ts
import { SignalSealAttributionSdk, EventType } from '@signalseal/react-native';

SignalSealAttributionSdk.configure({
  apiKey: 'ak_ios_01J...', // or ak_android_*
  isDebug: __DEV__,
  logLevel: 'info',
});

SignalSealAttributionSdk.sendEvent(EventType.Purchase, {
  revenue: 9.99,
  currency: 'USD',
});

SignalSealAttributionSdk.setUserAttributes({
  email: 'user@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
});

const signalSealId = await SignalSealAttributionSdk.getSignalSealId();
const attribution = await SignalSealAttributionSdk.getAttributionParams();
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
| `deleteUserData()` | `Promise<void>` | iOS, Android |
| `enableAppleAdsAttribution()` | `void` | iOS only (Android no-op) |
| `enablePurchaseTracking()` | `void` | iOS only (Android no-op) |

## Requirements

- React Native **0.71+**
- iOS **15.0+**
- Android **API 21+**

## Architecture

This package supports both the legacy and new React Native architectures. The TurboModule spec lives at `src/NativeSignalSeal.ts`; `TurboModuleRegistry.getEnforcing` is used on new-arch builds with a `NativeModules` fallback for legacy.

## License

MIT
