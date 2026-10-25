# curdr 0.10.3

Includes the 0.10.2 native media-upload repair and proactive compact visual guidance. Also preserves camera uploads in browser Demo mode: camera captures have a URI without a browser File, so Demo now resolves the same real Blob/File as connected mode instead of calling the native filesystem on the web.

Use Android 0.10.3 and Gateway/Web 0.10.3. Data/profile stay on the same server data path. 27 Node tests cover the exact installed Expo encoder regression and native/web binary upload forms; 86 backend tests cover server behavior. TypeScript and the production web export pass. Physical-phone and private Hermes acceptance are not inferred from serializer/build success.
