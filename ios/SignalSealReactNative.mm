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

// Our bridge touches the main-thread `UIDevice.identifierForVendor` via
// `getIdfv()` — the Swift side dispatches onto the main queue when
// needed, so we don't require the RN runtime to set the module up on
// the main queue.
+ (BOOL)requiresMainQueueSetup {
  return NO;
}

// Dedicated queue keeps bridge work off the JS thread. Swift-side state
// uses its own locks, so contention here is just for the Obj-C
// marshalling layer.
- (dispatch_queue_t)methodQueue {
  return dispatch_queue_create("dev.signalseal.reactnative", DISPATCH_QUEUE_SERIAL);
}

#pragma mark - Fire-and-forget methods

RCT_EXPORT_METHOD(configure:(NSDictionary *)args)
{
  [[SignalSealBridge shared] configureWithArgs:args];
}

RCT_EXPORT_METHOD(sendEvent:(NSString *)eventType
                  name:(NSString * _Nullable)name
                  parameters:(NSDictionary * _Nullable)parameters)
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

#pragma mark - Promise-returning methods

RCT_EXPORT_METHOD(flush:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[SignalSealBridge shared] flushWithResolve:^(id _Nullable value) {
    resolve(value);
  } reject:^(NSString * _Nonnull code, NSString * _Nonnull message, NSError * _Nullable error) {
    reject(code, message, error);
  }];
}

RCT_EXPORT_METHOD(getSignalSealId:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[SignalSealBridge shared] getSignalSealIdWithResolve:^(id _Nullable value) {
    // Swift returns `NSNull` for the nil-case; RN's bridge converts
    // that to JS `null`. We pass through verbatim.
    resolve(value);
  } reject:^(NSString * _Nonnull code, NSString * _Nonnull message, NSError * _Nullable error) {
    reject(code, message, error);
  }];
}

RCT_EXPORT_METHOD(getIdfv:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[SignalSealBridge shared] getIdfvWithResolve:^(id _Nullable value) {
    resolve(value);
  } reject:^(NSString * _Nonnull code, NSString * _Nonnull message, NSError * _Nullable error) {
    reject(code, message, error);
  }];
}

RCT_EXPORT_METHOD(getAttributionParams:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[SignalSealBridge shared] getAttributionParamsWithResolve:^(id _Nullable value) {
    resolve(value);
  } reject:^(NSString * _Nonnull code, NSString * _Nonnull message, NSError * _Nullable error) {
    reject(code, message, error);
  }];
}

RCT_EXPORT_METHOD(isSdkDisabled:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[SignalSealBridge shared] isSdkDisabledWithResolve:^(id _Nullable value) {
    resolve(value);
  } reject:^(NSString * _Nonnull code, NSString * _Nonnull message, NSError * _Nullable error) {
    reject(code, message, error);
  }];
}

RCT_EXPORT_METHOD(deleteUserData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[SignalSealBridge shared] deleteUserDataWithResolve:^(id _Nullable value) {
    resolve(value);
  } reject:^(NSString * _Nonnull code, NSString * _Nonnull message, NSError * _Nullable error) {
    reject(code, message, error);
  }];
}

@end
