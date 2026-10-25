import {Platform} from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
export type PushTarget={channel?:string;taskId?:string;approvalId?:string;messageId?:string};
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:false,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false})});
export function pushSetup(){
 if(Constants.executionEnvironment==='storeClient')return 'Install the Android release app. Expo Go does not support remote push.';
 if(!Constants.expoConfig?.extra?.eas?.projectId)return 'This build needs an Expo project ID and FCM credentials. See docs/NOTIFICATIONS.md.';
 if(Platform.OS==='android'&&!Constants.expoConfig?.extra?.pushConfigured)return 'This build needs google-services.json and FCM credentials. See docs/NOTIFICATIONS.md.';
 return '';
}
export async function requestPush():Promise<string>{
 const missing=pushSetup();if(missing)throw Error(missing);
 if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('attention',{name:'Decisions & results',importance:Notifications.AndroidImportance.HIGH,vibrationPattern:[0,120],lightColor:'#C5DCA9'});
 let permission=await Notifications.getPermissionsAsync();
 if(!permission.granted)permission=await Notifications.requestPermissionsAsync();
 if(!permission.granted)throw Error('Notification permission was not granted. You can enable it in Android settings.');
 const projectId=Constants.expoConfig?.extra?.eas?.projectId;
 return (await Notifications.getExpoPushTokenAsync({projectId})).data;
}
export function listenForPush(callback:(target:PushTarget)=>void){
 const seen=new Set<string>();
 const deliver=(response:Notifications.NotificationResponse|null)=>{if(!response)return;const id=response.notification.request.identifier;if(seen.has(id))return;seen.add(id);const data=response.notification.request.content.data||{};callback({channel:typeof data.channel==='string'?data.channel:undefined,taskId:typeof data.taskId==='string'?data.taskId:undefined,approvalId:typeof data.approvalId==='string'?data.approvalId:undefined,messageId:typeof data.messageId==='string'?data.messageId:undefined});};
 const subscription=Notifications.addNotificationResponseReceivedListener(deliver);
 void Notifications.getLastNotificationResponseAsync().then(response=>{deliver(response);if(response)void Notifications.clearLastNotificationResponseAsync();});
 return ()=>subscription.remove();
}
