// Expo config plugin for `@signalseal/react-native`. Handles the bits that
// an Expo-managed app otherwise can't configure (no native code access):
//
//   - iOS: injects `NSAdvertisingAttributionReportEndpoint` into Info.plist
//     (required for Apple Search Ads attribution). Defaults to the
//     SignalSeal events-api domain (`https://events.api.signalseal.net/ios/`)
//     but can be overridden in app config.
//
//   - Android: our manifest merges INTERNET, ACCESS_NETWORK_STATE, and
//     AD_ID from the SDK AAR. Nothing to inject. The plugin still exists
//     as the forward-compatible hook for future needs.
//
// Usage in the consuming app's `app.json` / `app.config.ts`:
//
//   "plugins": [
//     ["@signalseal/react-native", {
//       "iosAttributionReportEndpoint": "https://events.api.signalseal.net/ios/"
//     }]
//   ]
//
// With no options:
//
//   "plugins": ["@signalseal/react-native"]

import type { ConfigPlugin } from '@expo/config-plugins'
import { withInfoPlist } from '@expo/config-plugins'

export interface SignalSealPluginProps {
	/**
	 * URL used for Apple Search Ads attribution reporting. Written to
	 * `Info.plist` as `NSAdvertisingAttributionReportEndpoint`. Defaults to
	 * `https://events.api.signalseal.net/ios/` when omitted. If the app already
	 * has a different attribution endpoint set (e.g., from another SDK),
	 * explicitly pass `iosAttributionReportEndpoint: null` to leave it
	 * alone.
	 */
	iosAttributionReportEndpoint?: string | null
}

const DEFAULT_ENDPOINT = 'https://events.api.signalseal.net/ios/'

const withSignalSealAttributionEndpoint: ConfigPlugin<SignalSealPluginProps> = (
	config,
	props
) => {
	const endpoint =
		props?.iosAttributionReportEndpoint === null
			? null
			: props?.iosAttributionReportEndpoint ?? DEFAULT_ENDPOINT

	if (endpoint === null) return config

	return withInfoPlist(config, (cfg) => {
		cfg.modResults.NSAdvertisingAttributionReportEndpoint = endpoint
		return cfg
	})
}

const withSignalSeal: ConfigPlugin<SignalSealPluginProps | void> = (
	config,
	props
) => {
	const normalisedProps: SignalSealPluginProps = props ?? {}
	return withSignalSealAttributionEndpoint(config, normalisedProps)
}

export default withSignalSeal
