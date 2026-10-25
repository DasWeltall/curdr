# Verification · 0.9.1

25 October 2026. This is a source/gateway release, not a new signed APK.

## Checks

72 Python tests pass. New coverage checks preservation of custom network/profile/key settings during reconfiguration, literal private-key-file parsing without shell evaluation, web-export updates and recovered terminal runs not blocking the scheduler. Existing tests cover storage/scopes, live streaming, canonical approvals, jobs/routines, bounded files, commands and skill edits.

20 Node tests, TypeScript and the production web export pass. The installer has a shell syntax check. No paid model evaluation was run. The 12-case founder behavior review set describes desired outcomes and failure conditions; it is not a score or a guarantee of model behavior.

## Limits

The actual owner's server, service manager, private LAN and phones were not accessible. The installer must still be accepted on those devices/environments. A source build and read-only mocked API checks do not prove real microphone/camera/keyboard behavior, successful HTTPS deployment or all installed Hermes versions.

The previous 0.9.0 ARM64 APK remains a separate preview artifact. No new Android/iOS binary is claimed. Native push, semantic reminder deduplication, daily interruption budgets, live desktop video and TencentDB are not shipped by this release.

The public product website uses illustrative conversations and no model requests, analytics or signup collection. Its install instructions deliberately preserve host permissions, state and existing schedules.

## Website browser QA

Desktop: Brain dump, Reality check and Morning brief each render the appropriate example response and compact result card. Reset and FAQ expansion work. The copy control reports its manual fallback on the HTTP preview; its HTTPS behavior is checked separately after deployment. A 390px iframe viewport (375px content area after the scrollbar) renders without horizontal overflow after correcting a decorative background. This checks responsive web layout, not a physical iPhone.
