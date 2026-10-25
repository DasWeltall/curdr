# Gateway 0.10.1

Push receipt tracking now runs separately from the send queue. A new approval/result is no longer delayed for up to fifteen minutes by the previous delivery ticket. Persisted receipt retries and invalid-token handling remain active. Android/Web 0.10.0 clients are unchanged and compatible.

85 backend tests pass, including consecutive sends before the first receipt. Remote device delivery still needs owner FCM/Expo credentials. This is a gateway-only release; the Android app remains version 0.10.0.
