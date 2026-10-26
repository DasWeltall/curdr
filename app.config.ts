import {ExpoConfig,ConfigContext} from 'expo/config';
export default ({config}:ConfigContext):ExpoConfig=>({
 ...config,name:'curdr',slug:'curdr',
 android:{...config.android,...(process.env.GOOGLE_SERVICES_JSON?{googleServicesFile:process.env.GOOGLE_SERVICES_JSON}:{}),adaptiveIcon:{foregroundImage:'./assets/adaptive-icon.png',backgroundColor:'#F5F5FA'}},
 extra:{...config.extra,pushConfigured:!!process.env.GOOGLE_SERVICES_JSON,eas:{...(config.extra?.eas||{}),...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID?{projectId:process.env.EXPO_PUBLIC_EAS_PROJECT_ID}:{})}},
});
