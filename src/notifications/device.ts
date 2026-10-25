export type PushTarget={channel?:string;taskId?:string;approvalId?:string;messageId?:string};
export async function requestPush():Promise<string>{throw Error('Remote push is available in the Android release app. Web notifications are not configured.');}
export function listenForPush(_callback:(target:PushTarget)=>void){return ()=>{};}
export function pushSetup(){return 'Open the Android app to enable notifications.';}
