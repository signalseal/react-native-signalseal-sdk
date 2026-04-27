package net.signalseal.reactnative

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * React Native package registration. Autolinking on RN >= 0.71 picks
 * this up by scanning `node_modules/<pkg>/android` for a class extending
 * `BaseReactPackage`; no `react-native.config.js` shim required.
 *
 * `BaseReactPackage` is the new-arch-aware replacement for the legacy
 * `ReactPackage` interface. It satisfies both code paths:
 *   - Old arch: `getModule(name)` returns the bridge module on demand.
 *   - New arch: `getReactModuleInfoProvider()` advertises the module as
 *     `isTurboModule = true` so the TurboModuleRegistry knows to spin
 *     it up via the codegen-generated JSI plumbing.
 */
class SignalSealReactNativePackage : BaseReactPackage() {

    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
        if (name == SignalSealReactNativeModule.NAME) {
            SignalSealReactNativeModule(reactContext)
        } else {
            null
        }

    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            SignalSealReactNativeModule.NAME to ReactModuleInfo(
                /* name */ SignalSealReactNativeModule.NAME,
                /* className */ SignalSealReactNativeModule::class.java.name,
                /* canOverrideExistingModule */ false,
                /* needsEagerInit */ false,
                /* isCxxModule */ false,
                /* isTurboModule */ true,
            ),
        )
    }
}
