# Publication and releases

Public source: https://github.com/DasWeltall/curdr. Product site: https://curdr-founders.codingpenguin.chatgpt.site. The app, gateway, installer instructions, skills and website are in one repository; credentials, runtime data, SDKs, native generated projects and private hosting identity are excluded from the public source snapshot.

Before publishing a release: run the Node/TypeScript/web checks and the Python tests with pytest-asyncio installed. Review the diff for runtime state and credentials. Commit and push the exact source. Create a prerelease/tag at that actual commit after checks pass; don't claim GitHub CI succeeded before its run finishes.

Build the standalone product website:

```bash
python3 scripts/build-website.py --out artifacts/website
```

Deploy that directory to a static host. Agent guides use GitHub Raw and pin the exact source commit. Do not make installation depend on the marketing host: it can reject automated clients even when the page works in a browser. Preserve older download URLs already shared with users. Tag a new version for runtime changes and update the guide’s expected commit only after verifying it.

The GitHub Android workflow can build a preview manually or for a tag/release. Preview signing uses Expo's standard development certificate. Configure an owner-controlled production keystore for store distribution and verify the actual APK before claiming availability. The current 0.9.1 publication is a source/gateway release, not a new APK.

Keep private personal deployments private. The public marketing website does not expose a shared agent or a multi-user curdr account system. Do not post social content automatically as part of a release; the challenge plan contains drafts only.
