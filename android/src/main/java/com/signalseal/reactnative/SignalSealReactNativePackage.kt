package com.signalseal.reactnative

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * React Native package registration. Autolinked in the host app via
 * `react-native.config.js`:
 *
 *     dependency: {
 *       platforms: {
 *         android: {
 *           packageImportPath: 'import com.signalseal.reactnative.SignalSealReactNativePackage;',
 *           packageInstance: 'new SignalSealReactNativePackage()',
 *         },
 *       },
 *     }
 *
 * Required when the consumer app runs on the legacy Android
 * architecture. New-arch apps using autolinking + codegen don't strictly
 * need this (the TurboModule registry would wire things directly), but
 * shipping it keeps both paths working off a single build.
 */
class SignalSealReactNativePackage : ReactPackage {

    override fun createNativeModules(
        reactContext: ReactApplicationContext,
    ): List<NativeModule> = listOf(SignalSealReactNativeModule(reactContext))

    override fun createViewManagers(
        reactContext: ReactApplicationContext,
    ): List<ViewManager<*, *>> = emptyList()
}
