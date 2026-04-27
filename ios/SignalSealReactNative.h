// SignalSealReactNative.h
//
// ObjC header for the RN bridge module. The implementation (.mm) is
// Obj-C++ so it can include RN's C++ headers; it then forwards calls
// into SignalSealBridge.swift via the auto-generated Swift header.
//
// On new arch (RCT_NEW_ARCH_ENABLED defined by `install_modules_dependencies`
// when the host opts in), we conform to the codegen-generated
// `<NativeSignalSealSpec>` protocol so RN's TurboModuleRegistry wires
// us up via JSI directly. On old arch, we fall back to plain
// `<RCTBridgeModule>` and the bridge dispatches via `RCT_EXPORT_METHOD`.
//
// The same `.mm` file implements both — codegen-emitted method
// signatures align with the existing `RCT_EXPORT_METHOD` declarations
// because we kept the spec's object args as `{ [key: string]: unknown }`,
// which codegen lowers to `NSDictionary *` rather than a typed struct.

#import <React/RCTBridgeModule.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <NativeSignalSealSpec/NativeSignalSealSpec.h>

@interface SignalSealReactNative : NSObject <NativeSignalSealSpec>
@end

#else

@interface SignalSealReactNative : NSObject <RCTBridgeModule>
@end

#endif
