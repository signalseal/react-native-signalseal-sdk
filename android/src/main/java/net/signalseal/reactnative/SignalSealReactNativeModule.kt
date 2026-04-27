package net.signalseal.reactnative

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.module.annotations.ReactModule
import net.signalseal.attribution.EventType
import net.signalseal.attribution.LogLevel
import net.signalseal.attribution.SignalSealSDK
import net.signalseal.attribution.UserAttributes
import net.signalseal.attribution.events.SignalSealEnvironment

/**
 * React Native bridge module for the SignalSeal Android SDK.
 *
 * Extends the codegen-generated `NativeSignalSealSpec` so the same class
 * works on both architectures: on new-arch hosts, RNGP wires this up
 * as a real TurboModule (JSI-direct, no bridge hop); on old-arch hosts,
 * the spec class still extends `ReactContextBaseJavaModule` so the
 * legacy bridge dispatches to these overrides via reflection.
 *
 * Method signatures must match the codegen output exactly. The TS spec
 * lives at `src/NativeSignalSeal.ts` and `package.json#codegenConfig.name`
 * (`NativeSignalSealSpec`) controls the generated class name.
 *
 * Bridging rules:
 *   - Fire-and-forget calls (`configure`, `sendEvent`, setters) take no
 *     Promise argument; exceptions surface as JS console errors.
 *   - Promise-returning calls reject with a code+message that the TS
 *     facade wraps into `SignalSealError` via the error's `.code` field.
 */
@ReactModule(name = SignalSealReactNativeModule.NAME)
class SignalSealReactNativeModule(reactContext: ReactApplicationContext) :
    NativeSignalSealSpec(reactContext) {

    override fun getName(): String = NAME

    // --------------------------------------------------------------
    // Fire-and-forget methods
    // --------------------------------------------------------------

    override fun configure(args: ReadableMap) {
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
        val environment = mapEnvironment(args.getStringSafe("environment"))

        // The Android SDK requires a non-null `endpointBaseUrl` at the
        // Kotlin-level overload; when unset we fall back to the SDK's
        // documented default. Matching the iOS behaviour (where `nil`
        // means "use SDK default"), we call the no-endpoint overload
        // via the `@JvmOverloads` variant.
        if (endpointBaseUrl != null) {
            SignalSealSDK.configure(
                context = reactApplicationContext,
                apiKey = apiKey,
                isDebug = isDebug,
                endpointBaseUrl = endpointBaseUrl,
                logLevel = logLevel,
                customerUserId = customerUserId,
                environment = environment,
            )
        } else {
            SignalSealSDK.configure(
                context = reactApplicationContext,
                apiKey = apiKey,
                isDebug = isDebug,
                logLevel = logLevel,
                customerUserId = customerUserId,
                environment = environment,
            )
        }
    }

    override fun sendEvent(eventType: String, name: String?, parameters: ReadableMap?) {
        val type = runCatching { EventType.valueOf(eventType) }.getOrElse {
            // TS facade already validates — getting here means the
            // caller bypassed the facade (bare NativeModules call?). We
            // treat the call as invalid and drop rather than sending a
            // phantom `CUSTOM` event without a name.
            return
        }
        // `ReadableMap.toHashMap()` types values as `Any?`; the SDK
        // takes `Map<String, Any>?`. Filter the nulls (cast is then
        // safe) to match iOS, where the JSON-null → `nil` mapping
        // simply omits the key.
        @Suppress("UNCHECKED_CAST")
        val params = parameters?.toHashMap()?.filterValues { it != null } as Map<String, Any>?
        SignalSealSDK.sendEvent(
            event = type,
            name = name,
            parameters = params,
        )
    }

    override fun setUserAttributes(attrs: ReadableMap) {
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
        SignalSealSDK.setUserAttributes(ua)
    }

    override fun enableAppleAdsAttribution() {
        // iOS-only API. No-op on Android; the TS facade short-circuits
        // before getting here, but we guard against direct native calls.
    }

    override fun enablePurchaseTracking() {
        // iOS-only. Play Billing tracking isn't in the public
        // Android SDK yet — when it lands, wire it up here.
    }

    override fun resetData() {
        SignalSealSDK.resetData()
    }

    // --------------------------------------------------------------
    // Promise-returning methods
    // --------------------------------------------------------------

    override fun flush(promise: Promise) {
        try {
            SignalSealSDK.flush()
            promise.resolve(null)
        } catch (t: Throwable) {
            promise.reject("FLUSH_FAILED", t.message, t)
        }
    }

    override fun getSignalSealId(promise: Promise) {
        try {
            promise.resolve(SignalSealSDK.getSignalSealId())
        } catch (t: Throwable) {
            promise.reject("GET_SIGNALSEAL_ID_FAILED", t.message, t)
        }
    }

    override fun getAttributionParams(promise: Promise) {
        try {
            val map = SignalSealSDK.getAttributionParams()
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

    override fun isSdkDisabled(promise: Promise) {
        try {
            promise.resolve(SignalSealSDK.isSdkDisabled())
        } catch (t: Throwable) {
            promise.reject("IS_SDK_DISABLED_FAILED", t.message, t)
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
        "off" -> LogLevel.OFF
        "error" -> LogLevel.ERROR
        "warn" -> LogLevel.WARN
        "info" -> LogLevel.INFO
        "debug" -> LogLevel.DEBUG
        else -> LogLevel.INFO
    }

    /**
     * Map the JS-side lowercase environment string to the native enum.
     * Returns `null` when the value is absent or unrecognized — the
     * native SDK then auto-detects via `FLAG_DEBUGGABLE` + emulator
     * heuristics. The TS facade rejects unrecognized values, so getting
     * here with a bad value means a direct `NativeModules` call
     * bypassed validation.
     */
    private fun mapEnvironment(raw: String?): SignalSealEnvironment? = when (raw) {
        "production" -> SignalSealEnvironment.PRODUCTION
        "sandbox" -> SignalSealEnvironment.SANDBOX
        else -> null
    }

    companion object {
        const val NAME = "SignalSealReactNative"
    }
}
