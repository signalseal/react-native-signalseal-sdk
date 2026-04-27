// SignalSealReactNative.mm
//
// Obj-C++ RN module. Every exported method forwards directly to the
// `SignalSealBridge` Swift class (see SignalSealBridge.swift). We keep
// this file mechanical — validation + coercion live in the JS facade
// and the Swift bridge, not here.

#import "SignalSealReactNative.h"
#import <React/RCTLog.h>

// Import the Swift-generated header. The name is `<ModuleName>-Swift.h`
// — for a CocoaPods install that's `SignalSealReactNative-Swift.h`.
// Xcode synthesizes it during Pod build; if it's missing at compile
// time, double-check the pod's `DEFINES_MODULE = YES` setting.
#if __has_include("SignalSealReactNative-Swift.h")
#import "SignalSealReactNative-Swift.h"
#else
#import <SignalSealReactNative/SignalSealReactNative-Swift.h>
#endif

@implementation SignalSealReactNative

RCT_EXPORT_MODULE(SignalSealReactNative)

// No main-queue-only work happens on module init; the Swift side
// dispatches to the main queue internally when it needs to.
+ (BOOL)requiresMainQueueSetup {
  return NO;
}

// Dedicated queue keeps bridge work off the JS thread. Swift-side state
// uses its own locks, so contention here is just for the Obj-C
// marshalling layer.
- (dispatch_queue_t)methodQueue {
  return dispatch_queue_create("net.signalseal.reactnative", DISPATCH_QUEUE_SERIAL);
}

#pragma mark - Fire-and-forget methods

RCT_EXPORT_METHOD(configure:(NSDictionary *)args)
{
  [[SignalSealBridge shared] configureWithArgs:args];
}

// Param nullability deliberately omitted: the codegen-generated
// `<NativeSignalSealSpec>` protocol declares these inside its own
// `NS_ASSUME_NONNULL_BEGIN` block, so explicit `_Nullable` here would
// conflict at compile time. The RCT bridge converts JS undefined to
// nil and the Swift bridge takes `String?` / `NSDictionary?`, so nil
// at runtime is handled correctly even though the static signature
// reads as nonnull.
RCT_EXPORT_METHOD(sendEvent:(NSString *)eventType
                  name:(NSString *)name
                  parameters:(NSDictionary *)parameters)
{
  [[SignalSealBridge shared] sendEventWithType:eventType name:name parameters:parameters];
}

RCT_EXPORT_METHOD(setUserAttributes:(NSDictionary *)attrs)
{
  [[SignalSealBridge shared] setUserAttributesWithAttrs:attrs];
}

RCT_EXPORT_METHOD(enableAppleAdsAttribution)
{
  [[SignalSealBridge shared] enableAppleAdsAttribution];
}

RCT_EXPORT_METHOD(enablePurchaseTracking)
{
  [[SignalSealBridge shared] enablePurchaseTracking];
}

RCT_EXPORT_METHOD(resetData)
{
  [[SignalSealBridge shared] resetData];
}

#pragma mark - Promise-returning methods

// Selector convention: `methodName:reject:` (NOT `methodName:rejecter:`).
// On new arch (TurboModule), codegen generates the spec with `reject:`
// as the second selector part — using `rejecter:` here would register
// `methodName:rejecter:` and JSI would hit "unrecognized selector" at
// runtime when JS calls the Promise method. On old arch the bridge
// dispatches by reflection and accepts either, so `reject:` works for
// both.

RCT_EXPORT_METHOD(flush:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[SignalSealBridge shared] flushWithResolve:^(id _Nullable value) {
    resolve(value);
  } reject:^(NSString * _Nonnull code, NSString * _Nonnull message, NSError * _Nullable error) {
    reject(code, message, error);
  }];
}

RCT_EXPORT_METHOD(getSignalSealId:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[SignalSealBridge shared] getSignalSealIdWithResolve:^(id _Nullable value) {
    // Swift returns `NSNull` for the nil-case; RN's bridge converts
    // that to JS `null`. We pass through verbatim.
    resolve(value);
  } reject:^(NSString * _Nonnull code, NSString * _Nonnull message, NSError * _Nullable error) {
    reject(code, message, error);
  }];
}

RCT_EXPORT_METHOD(getAttributionParams:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[SignalSealBridge shared] getAttributionParamsWithResolve:^(id _Nullable value) {
    resolve(value);
  } reject:^(NSString * _Nonnull code, NSString * _Nonnull message, NSError * _Nullable error) {
    reject(code, message, error);
  }];
}

RCT_EXPORT_METHOD(isSdkDisabled:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  [[SignalSealBridge shared] isSdkDisabledWithResolve:^(id _Nullable value) {
    resolve(value);
  } reject:^(NSString * _Nonnull code, NSString * _Nonnull message, NSError * _Nullable error) {
    reject(code, message, error);
  }];
}

#pragma mark - New architecture (TurboModule)

#ifdef RCT_NEW_ARCH_ENABLED
// JSI plumbing for new arch. The codegen-generated `NativeSignalSealSpecJSI`
// wraps our protocol implementation so RN's TurboModuleRegistry can call
// us directly from JS without going through the legacy bridge. The
// method bodies above (declared via `RCT_EXPORT_METHOD`) satisfy the
// `<NativeSignalSealSpec>` protocol because we kept loose
// `NSDictionary *` arg types — see `ios/SignalSealReactNative.h`.
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeSignalSealSpecJSI>(params);
}
#endif

@end
