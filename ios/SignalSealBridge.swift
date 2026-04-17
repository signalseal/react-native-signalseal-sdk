// SignalSealBridge.swift
//
// @objc shim that adapts the Swift-native `SignalSealAttributionSdk`
// surface to the RCT-friendly callback-and-NSDictionary idiom the .mm
// file uses. RCT can't speak Swift optionals, enums, or `async`
// functions directly; everything here funnels through types Obj-C can
// see.
//
// The public iOS SDK is exposed through the `SignalSealSDK` module
// (see sdks/ios/Package.swift), which re-exports the underlying
// `SignalSealAttributionSDK` core. We import the public one only.

import Foundation
import SignalSealSDK

/// Block types — mirror RCTPromiseResolveBlock / RCTPromiseRejectBlock
/// but typed in Swift so the `@objc` boundary stays clean.
public typealias SSResolve = (Any?) -> Void
public typealias SSReject = (String, String, NSError?) -> Void

@objc(SignalSealBridge)
public final class SignalSealBridge: NSObject {

    /// Shared instance — the RN module file holds a pointer to this
    /// singleton and calls through to it per bridged method.
    @objc public static let shared = SignalSealBridge()

    private override init() { super.init() }

    // MARK: - Configure

    /// Maps the TS `ConfigureArgs` dictionary to the Swift SDK's
    /// `configure()` call. Unknown / missing keys fall back to the
    /// native defaults — we never paper over them on this side.
    @objc public func configure(args: NSDictionary) {
        guard let apiKey = args["apiKey"] as? String, !apiKey.isEmpty else {
            // TS facade already validates; if we got here with a bad
            // value we log and drop rather than crash the process.
            NSLog("[SignalSeal] configure: missing apiKey; ignoring")
            return
        }
        let isDebug = (args["isDebug"] as? Bool) ?? false
        let endpointBaseUrl = args["endpointBaseUrl"] as? String
        let customerUserId = args["customerUserId"] as? String
        let level = mapLogLevel(args["logLevel"] as? String)

        SignalSealAttributionSdk.shared.configure(
            apiKey: apiKey,
            isDebug: isDebug,
            endpointBaseUrl: endpointBaseUrl,
            logLevel: level,
            customerUserId: customerUserId
        )
    }

    private func mapLogLevel(_ raw: String?) -> LogLevel {
        switch raw {
        case "off": return .off
        case "error": return .error
        case "warn": return .warn
        case "info": return .info
        case "debug": return .debug
        default: return .info
        }
    }

    // MARK: - Events

    @objc public func sendEvent(type: String, name: String?, parameters: NSDictionary?) {
        let eventType = EventType(rawValue: type) ?? .custom
        let params = (parameters as? [String: Any])
        SignalSealAttributionSdk.shared.sendEvent(event: eventType, name: name, parameters: params)
    }

    @objc public func setUserAttributes(attrs: NSDictionary) {
        // The TS facade already rewrote to snake_case. We reconstruct
        // the Swift `UserAttributes` struct by pulling the expected
        // keys back out — anything else is dropped. We deliberately do
        // NOT forward "extra" keys: the native SDK has a typed struct
        // and we want parity across the three entry points (native,
        // Flutter bridge, RN bridge).
        let attributes = UserAttributes(
            email: attrs["email"] as? String,
            phone: attrs["phone"] as? String,
            firstName: attrs["first_name"] as? String,
            lastName: attrs["last_name"] as? String,
            dob: attrs["dob"] as? String,
            gender: attrs["gender"] as? String,
            city: attrs["city"] as? String,
            state: attrs["state"] as? String,
            zip: attrs["zip"] as? String,
            country: attrs["country"] as? String,
            externalId: attrs["external_id"] as? String
        )
        SignalSealAttributionSdk.shared.setUserAttributes(attributes)
    }

    // MARK: - Attribution control

    @objc public func enableAppleAdsAttribution() {
        if #available(iOS 15.0, *) {
            SignalSealASAAttribution.shared.enableAppleAdsAttribution()
        } else {
            NSLog("[SignalSeal] enableAppleAdsAttribution requires iOS 15+; ignoring")
        }
    }

    @objc public func enablePurchaseTracking() {
        SignalSealAttributionSdk.shared.enablePurchaseTracking()
    }

    // MARK: - Promise-returning APIs

    @objc public func flush(resolve: @escaping SSResolve, reject: @escaping SSReject) {
        // `flush()` is fire-and-forget on the Swift side; resolve
        // synchronously once the scheduling call has returned. The JS
        // contract is "flush was requested", not "flush has landed on
        // the wire" — matching the native behaviour.
        SignalSealAttributionSdk.shared.flush()
        resolve(NSNull())
    }

    @objc public func getInstallationId(resolve: @escaping SSResolve, reject: @escaping SSReject) {
        let id = SignalSealAttributionSdk.shared.getInstallationId()
        resolve(id as Any? ?? NSNull())
    }

    @objc public func getIdfv(resolve: @escaping SSResolve, reject: @escaping SSReject) {
        // The Swift API is synchronous but main-thread-guarded; the
        // RN bridge queue isn't the main queue, so hop explicitly.
        DispatchQueue.main.async {
            let idfv = SignalSealAttributionSdk.shared.getIdfv()
            resolve(idfv as Any? ?? NSNull())
        }
    }

    @objc public func getAttributionParams(resolve: @escaping SSResolve, reject: @escaping SSReject) {
        // Hop to an async context so we can await the attribution gate
        // without blocking the RN method queue. `Task` inherits the
        // default actor, which is fine — we serialize back into Obj-C
        // types inside the task before calling `resolve`.
        Task { [resolve] in
            let params = await SignalSealAttributionSdk.shared.getAttributionParams()
            guard let dict = params else {
                resolve(NSNull())
                return
            }
            // The TS side coerces values to strings; doing the coercion
            // here as well is defensive (Obj-C can already pass Any) but
            // costs nothing and keeps the JS contract explicit.
            var out: [String: String] = [:]
            for (k, v) in dict {
                if let s = v as? String {
                    out[k] = s
                } else {
                    out[k] = String(describing: v)
                }
            }
            resolve(out as NSDictionary)
        }
    }

    @objc public func isSdkDisabled(resolve: @escaping SSResolve, reject: @escaping SSReject) {
        resolve(NSNumber(value: SignalSealAttributionSdk.shared.isSdkDisabled()))
    }

    @objc public func deleteUserData(resolve: @escaping SSResolve, reject: @escaping SSReject) {
        Task { [resolve, reject] in
            do {
                try await SignalSealAttributionSdk.shared.deleteUserData()
                resolve(NSNull())
            } catch {
                // TS wraps this into `SignalSealError(NATIVE_ERROR, …)`.
                reject(
                    "DELETE_USER_DATA_FAILED",
                    error.localizedDescription,
                    error as NSError
                )
            }
        }
    }
}
