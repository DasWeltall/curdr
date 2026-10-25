# Android notifications

curdr uses Expo Push → Firebase Cloud Messaging → your Android release app. The gateway sends generic decisions/results, never message text or provider keys. Devices, cursors, delivery tickets and bounded retries are persisted in the private gateway database, outside profile exports. Sleep/quiet hours hold delivery; an active-app heartbeat suppresses duplicate notifications. Disabling notifications or disconnecting unregisters that device. Expo delivery is best effort, not an exactly-once guarantee; Android force-stop can block delivery until the app is reopened.

## Configure your own build

1. Create/link your Expo project and Firebase Android app for `net.curdr.app` (a fork should choose its own package ID).
2. Obtain `google-services.json` for that Firebase Android app. Keep the file outside Git. Upload the matching FCM v1 service account to the Expo project's Android credentials using EAS credentials; never ship that private service account in the app.
3. Build with `EXPO_PUBLIC_EAS_PROJECT_ID=YOUR_PROJECT_UUID` and `GOOGLE_SERVICES_JSON=/absolute/private/google-services.json`. `app.config.ts` reads them. `npm run build:apk` builds locally; EAS Build is also an option. The existing GitHub workflow accepts repository secrets `EXPO_PROJECT_ID` and `GOOGLE_SERVICES_JSON_BASE64` for the public client config. Configure FCM credentials in Expo separately.
4. On the gateway set `CURDR_PUSH_ENABLED=true` before starting the service. If Expo push access-token security is enabled, set the private `EXPO_ACCESS_TOKEN` on the gateway too.
5. Install the configured APK, connect, then Settings → Notifications → Enable notifications. Android asks permission. Tokens are registered through the authenticated curdr connection.

Expo Go cannot receive remote Android notifications. Builds without project/FCM configuration show the missing setup and cannot enable remote delivery. The repository has no project owner's Firebase/Expo credentials; an unconfigured preview APK does not have working remote push.

## Verify on a phone

- Confirm the Expo push token registered, put curdr in the background, and produce an actual pending approval or completed result on the same gateway. Tap the notification: it should open its channel.
- Check foreground suppression, quiet hours/sleep, Deny/Approve before delivery, disconnect and disable. Streamed tokens/tool steps must not generate notifications.
- Test after the process is swiped away (do not confuse that with Android's explicit Force stop), and after reboot. Validate Firebase/Expo receipt errors if no notification arrives. Provider acceptance alone is not proof of device delivery.

Official references: [Expo notifications](https://docs.expo.dev/versions/latest/sdk/notifications/), [push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [FCM credentials](https://docs.expo.dev/push-notifications/fcm-credentials/).
