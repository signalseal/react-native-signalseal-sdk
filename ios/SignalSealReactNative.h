// SignalSealReactNative.h
//
// ObjC header for the RN bridge module. The implementation (.mm) is
// Obj-C++ so it can include RN's C++ headers; it then forwards calls
// into SignalSealBridge.swift via the auto-generated Swift header.

#import <React/RCTBridgeModule.h>

@interface SignalSealReactNative : NSObject <RCTBridgeModule>
@end
