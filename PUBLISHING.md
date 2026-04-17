# Releasing — react-native-signalseal-sdk

This repo publishes `@signalseal/react-native` to npm. The package is a
thin TurboModule/ReactMethod bridge over the native iOS + Android SDKs
plus an Expo config plugin.

## What this package ships

```
@signalseal/react-native/
├── lib/                                       # compiled TS → JS (built on release)
├── src/                                       # TS source (included for source maps)
├── ios/                                       # Swift bridge + VENDORED xcframework
│   └── SignalSealAttributionSDK.xcframework/  # ~ re-vendored on every release ~
├── android/                                   # Kotlin bridge (depends on Maven
│                                              #   coord io.github.signalseal:*)
├── plugin/build/                              # compiled Expo plugin
├── app.plugin.js                              # Expo entry point
└── signalseal-react-native.podspec
```

## Release prerequisites — update BOTH native artefacts first

Because the iOS xcframework is vendored here, and the Android
dependency resolves from Maven Central, both must match the version
you're about to publish.

### 1. Rebuild + re-vendor iOS xcframework

```sh
cd ../ios-signalseal-core-sdk
./scripts/build-xcframework.sh
# script auto-copies to ../react-native-signalseal-sdk/ios/
```

If the iOS public SDK version changed, also bump
`../ios-signalseal-sdk/Package.swift` and cut the corresponding GitHub
release (see that repo's `PUBLISHING.md`).

### 2. Confirm Android Maven coord matches

`android/build.gradle` has:
```groovy
api 'io.github.signalseal:signalseal-android-sdk:<version>'
```
This version must already be published on Maven Central. See
`../android-signalseal-sdk/PUBLISHING.md`.

## Cutting a release

```sh
cd react-native-signalseal-sdk

# Bump versions — both the npm package and the podspec pull from
# package.json automatically:
vim package.json   # "version": "0.0.1" → "0.0.2"

# Rebuild TS + plugin:
npm install
npm run build
(cd plugin && npm install && npm run build)

# Commit vendored xcframework + lib/ if the vendored blob changed:
git add -A
git commit -m "chore: bump to v<version>"

# Tag:
git tag -a v<version> -m "v<version>"
git push origin main --tags

# Publish (requires npm login + @signalseal org access):
npm publish --access public --provenance
```

The `--provenance` flag enables npm's provenance attestation — the
published package shows a green "built + published from GitHub Actions"
badge. Requires the publish to happen from a CI job that has
`id-token: write` permission. For manual publishes from a local
machine, omit `--provenance`.

## Post-release verification

```sh
# From a fresh RN project:
npm install @signalseal/react-native@<version>
cd ios && pod install
# Should resolve + install without asking for extra pods.
# iOS: xcframework is vendored in node_modules/@signalseal/react-native/ios/
# Android: Maven coord resolves from Central automatically.
```

## CI for automated releases (future work)

Release workflow shape:

```yaml
on:
  push:
    tags: [v*]
jobs:
  publish:
    runs-on: macos-15
    permissions:
      id-token: write   # for npm provenance
    steps:
      - uses: actions/checkout@v4
      - run: brew install xcodegen
      # Rebuild vendored xcframework from the sibling private repo
      # (requires a PAT that can check out that private repo)
      - run: git clone --depth 1 --branch v${{ github.ref_name }} \
             https://x:${{ secrets.IOS_CORE_PAT }}@github.com/signalseal/ios-signalseal-core-sdk.git ../core
      - run: cd ../core && ./scripts/build-xcframework.sh
      - run: cp -R ../core/build/SignalSealAttributionSDK.xcframework ios/
      - run: npm ci && npm run build
      - run: (cd plugin && npm ci && npm run build)
      - run: npm publish --access public --provenance
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Do NOT

- Publish without first re-vendoring the iOS xcframework — the npm
  package MUST contain a matching xcframework inside `ios/`
- Manually edit `package-lock.json` — let npm regenerate it
- Hard-code native SDK versions in two places — keep `package.json
  version` canonical and reference it in Gradle/podspec/docs via
  substitution where possible
