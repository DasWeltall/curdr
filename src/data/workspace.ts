import {useCallback,useEffect,useState} from 'react';
import {useStore} from './store';
import {HttpTransport} from './http';
import {Transport} from './types';
export function request(api:Transport,path:string,method='GET',body?:unknown){if(api.mode!=='gateway')throw Error('Connect Hermes to use this workspace control.');return (api as HttpTransport).request(path,method,body);}
export function useResource<T>(path:string,initial:T){const {api,run}=useStore();const [value,set]=useState<T>(initial),[loading,setLoading]=useState(false);const refresh=useCallback(async()=>{if(api.mode!=='gateway')return;setLoading(true);const result=await run(()=>request(api,path));if(result!==undefined)set(result);setLoading(false);},[api,path]);useEffect(()=>{void refresh();},[refresh]);return {value,set,loading,refresh};}
export interface Routine {id:string;name:string;kind:'local'|'hermes';enabled?:boolean;paused?:boolean;prompt?:string;schedule?:string;time?:string;interval?:number;last_status?:string;next_run_at?:string;timezone?:string;}
export interface SkillItem {id:string;title:string;description?:string;source:string;category?:string;enabled:boolean;readOnly?:boolean;}
export const intervals:[[string,string],[string,string],[string,string],[string,string]]=[['30','30 min'],['60','1 hour'],['180','3 hours'],['300','5 hours']];
