require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "SignalSealReactNative"
  s.version      = package["version"]
  s.summary      = package["description"] || "SignalSeal React Native bridge"
  s.description  = package["description"] || "Thin bridge over the SignalSeal iOS + Android SDKs."
  s.homepage     = "https://signalseal.net"
  s.license      = { :type => "MIT" }
  s.authors      = { "SignalSeal" => "hello@signalseal.net" }
  s.source       = { :git => "https://github.com/signalseal/react-native.git", :tag => "v#{s.version}" }

  s.platforms    = { :ios => "15.0" }
  s.swift_version = "5.9"
  s.requires_arc = true

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.public_header_files = "ios/**/*.h"

  # Vendor the precompiled iOS SDK xcframework directly inside the RN
  # package (AppStack / AppsFlyer / Branch pattern). Consumers run
  # `pod install` and get everything in one step — no separate SPM or
  # Pod dependency required on the host app side.
  #
  # The binary is rebuilt from ../ios-signalseal-core-sdk/ via its
  # scripts/build-xcframework.sh (which auto-copies into ios/ here)
  # and committed under ios/SignalSealAttributionSDK.xcframework.
  s.vendored_frameworks = "ios/SignalSealAttributionSDK.xcframework"

  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES",
    "SWIFT_VERSION"  => "5.9",
    # New-arch codegen emits C++ interop; keep the search paths sane.
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++17",
  }

  s.dependency "React-Core"
end
