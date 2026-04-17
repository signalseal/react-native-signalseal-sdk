package com.signalseal.reactnative

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.signalseal.attribution.EventType
import com.signalseal.attribution.LogLevel
import com.signalseal.attribution.SignalSealAttributionSdk
import com.signalseal.attribution.UserAttributes

/**
 * React Native bridge module for the SignalSeal Android SDK.
 *
 * Old-architecture compatible (`ReactContextBaseJavaModule` + @ReactMethod).
 * New-arch apps pick this up via the autolinked ReactPackage; codegen
 * isn't involved on the Android side for this 0.0.1 cut — we accept the
 * small perf overhead of the legacy bridge in exchange for trivially
 * working on every supported RN version (>= 0.71) without per-arch
 * build flags.
 *
 * Bridging rules:
 *   - Fire-and-forget calls (`configure`, `sendEvent`, setters) take no
 *     Promise argument — RN's bridge runs them on the module's queue
 *     (the default `NativeModulesQueueThread`) and drops exceptions
 *     into the JS console.
 *   - Promise-returning calls use RN's `Promise` type; rejections are
 *     wrapped into `SignalSealError` on the JS side via the error's
 *     `.code` field.
 */
class SignalSealReactNativeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = MODULE_NAME

    // --------------------------------------------------------------
    // Fire-and-forget methods
    // --------------------------------------------------------------

    @ReactMethod
    fun configure(args: ReadableMap) {
        val apiKey = args.getStringSafe("apiKey") ?: run {
            // TS facade already enforces apiKey presence. If it still
            // arrived empty, swallow silently — the native SDK also
            // refuses to arm itself in this case.
            return
        }
        val isDebug = if (args.hasKey("isDebug")) args.getBoolean("isDebug") else false
        val endpointBaseUrl = args.getStringSafe("endpointBaseUrl")
        val customerUserId = args.getStringSafe("customerUserId")
        val logLevel = mapLogLevel(args.getStringSafe("logLevel"))

        // The Android SDK requires a non-null `endpointBaseUrl` at the
        // Kotlin-level overload; when unset we fall back to the SDK's
        // documented default. Matching the iOS behaviour (where `nil`
        // means "use SDK default"), we call the no-endpoint overload
        // by explicitly passing the default constant through reflection
        // isn't necessary — the `@JvmOverloads` on `configure` exposes
        // a variant without `endpointBaseUrl`, so we branch.
        if (endpointBaseUrl != null) {
            SignalSealAttributionSdk.configure(
                context = reactApplicationContext,
                apiKey = apiKey,
                isDebug = isDebug,
                endpointBaseUrl = endpointBaseUrl,
                logLevel = logLevel,
                customerUserId = customerUserId,
            )
        } else {
            SignalSealAttributionSdk.configure(
                context = reactApplicationContext,
                apiKey = apiKey,
                isDebug = isDebug,
                logLevel = logLevel,
                customerUserId = customerUserId,
            )
        }
    }

    @ReactMethod
    fun sendEvent(eventType: String, name: String?, parameters: ReadableMap?) {
        val type = runCatching { EventType.valueOf(eventType) }.getOrElse {
            // TS facade already validates — getting here means the
            // caller bypassed the facade (bare NativeModules call?). We
            // treat the call as invalid and drop rather than sending a
            // phantom `CUSTOM` event without a name.
            return
        }
        SignalSealAttributionSdk.sendEvent(
            event = type,
            name = name,
            parameters = parameters?.toHashMap(),
        )
    }

    @ReactMethod
    fun setUserAttributes(attrs: ReadableMap) {
        // The TS facade writes snake_case keys; reconstruct the typed
        // `UserAttributes` data class from them. Extras are ignored.
        val ua = UserAttributes(
            email = attrs.getStringSafe("email"),
            phone = attrs.getStringSafe("phone"),
            firstName = attrs.getStringSafe("first_name"),
            lastName = attrs.getStringSafe("last_name"),
            dob = attrs.getStringSafe("dob"),
            gender = attrs.getStringSafe("gender"),
            city = attrs.getStringSafe("city"),
            state = attrs.getStringSafe("state"),
            zip = attrs.getStringSafe("zip"),
            country = attrs.getStringSafe("country"),
            externalId = attrs.getStringSafe("external_id"),
        )
        SignalSealAttributionSdk.setUserAttributes(ua)
    }

    @ReactMethod
    fun enableAppleAdsAttribution() {
        // iOS-only API. No-op on Android; the TS facade short-circuits
        // before getting here, but we guard against direct native calls.
    }

    @ReactMethod
    fun enablePurchaseTracking() {
        // iOS-only for 0.0.1. Play Billing tracking isn't in the public
        // Android SDK yet — when it lands, wire it up here.
    }

    // --------------------------------------------------------------
    // Promise-returning methods
    // --------------------------------------------------------------

    @ReactMethod
    fun flush(promise: Promise) {
        try {
            SignalSealAttributionSdk.flush()
            promise.resolve(null)
        } catch (t: Throwable) {
            promise.reject("FLUSH_FAILED", t.message, t)
        }
    }

    @ReactMethod
    fun getSignalSealId(promise: Promise) {
        try {
            promise.resolve(SignalSealAttributionSdk.getSignalSealId())
        } catch (t: Throwable) {
            promise.reject("GET_SIGNALSEAL_ID_FAILED", t.message, t)
        }
    }

    @ReactMethod
    fun getAttributionParams(promise: Promise) {
        try {
            val map = SignalSealAttributionSdk.getAttributionParams()
            if (map.isEmpty()) {
                // Parity with iOS: return null when there are no
                // attribution params yet, so the TS facade's
                // `null`-check path triggers cleanly.
                promise.resolve(null)
                return
            }
            val writable = Arguments.createMap()
            for ((k, v) in map) {
                writable.putString(k, v)
            }
            promise.resolve(writable)
        } catch (t: Throwable) {
            promise.reject("GET_ATTRIBUTION_PARAMS_FAILED", t.message, t)
        }
    }

    @ReactMethod
    fun isSdkDisabled(promise: Promise) {
        try {
            promise.resolve(SignalSealAttributionSdk.isSdkDisabled())
        } catch (t: Throwable) {
            promise.reject("IS_SDK_DISABLED_FAILED", t.message, t)
        }
    }

    @ReactMethod
    fun deleteUserData(promise: Promise) {
        try {
            // Android SDK's equivalent is `clearData()` — there's no
            // server-side delete yet. This matches iOS's local-only
            // behaviour in 0.0.1.
            SignalSealAttributionSdk.clearData()
            promise.resolve(null)
        } catch (t: Throwable) {
            promise.reject("DELETE_USER_DATA_FAILED", t.message, t)
        }
    }

    // --------------------------------------------------------------
    // Helpers
    // --------------------------------------------------------------

    /**
     * `ReadableMap.getString(key)` throws on absent keys on some RN
     * versions. Guard with `hasKey` + null-coalesce to a safe default.
     */
    private fun ReadableMap.getStringSafe(key: String): String? {
        if (!hasKey(key)) return null
        if (isNull(key)) return null
        return getString(key)
    }

    private fun mapLogLevel(raw: String?): LogLevel = when (raw) {
        // The native Android enum doesn't have `OFF` — the closest
        // equivalent is silencing at WARN/ERROR. We map `off` to ERROR
        // so pathological verbosity is still capped without crashing
        // the SDK (which would happen on an unknown enum lookup).
        // TODO: if we add `OFF` to the Android LogLevel enum, update.
        "off" -> LogLevel.ERROR
        "error" -> LogLevel.ERROR
        "warn" -> LogLevel.WARN
        "info" -> LogLevel.INFO
        "debug" -> LogLevel.DEBUG
        else -> LogLevel.INFO
    }

    companion object {
        const val MODULE_NAME = "SignalSealReactNative"
    }
}
