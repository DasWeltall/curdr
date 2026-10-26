export type VisualBlock=
 |{type:'metrics';items:{label:string;value:string|number}[]}
 |{type:'chart';kind:'bar'|'line';title?:string;labels:string[];series:{name:string;values:number[]}[]}
 |{type:'table';columns:string[];rows:(string|number)[][]}
 |{type:'checklist';items:{text:string;done:boolean}[]}
 |{type:'calculator';label:string;min:number;max:number;step:number;value:number;multiplier:number;offset:number;resultLabel:string;unit:string}
 |{type:'progress';label:string;value:number;total:number;unit:string}
 |{type:'text';text:string};
export interface Visual{title:string;description:string;blocks:VisualBlock[];}
const text=(v:unknown,max=1500)=>typeof v==='string'&&v.length<=max;
const finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v);
export function parseVisual(content?:string):Visual|null{
 if(!content||content.length>65536)return null;
 try{const v=JSON.parse(content);if(!text(v.title,80)||!text(v.description||'',240)||!Array.isArray(v.blocks)||!v.blocks.length||v.blocks.length>8)return null;
 for(const b of v.blocks){
  if(b.type==='metrics'){if(!Array.isArray(b.items)||!b.items.length||b.items.length>6||b.items.some((i:any)=>!text(i.label,60)||!(text(i.value)||finite(i.value))))return null;}
  else if(b.type==='chart'){if(!['line','bar'].includes(b.kind)||!Array.isArray(b.labels)||!b.labels.length||b.labels.length>24||b.labels.some((x:unknown)=>!text(x,60))||!Array.isArray(b.series)||!b.series.length||b.series.length>4||b.series.some((s:any)=>!text(s.name,60)||!Array.isArray(s.values)||s.values.length!==b.labels.length||s.values.some((x:unknown)=>!finite(x))))return null;}
  else if(b.type==='table'){if(!Array.isArray(b.columns)||!b.columns.length||b.columns.length>6||b.columns.some((x:unknown)=>!text(x,100))||!Array.isArray(b.rows)||b.rows.length>30||b.rows.some((r:any)=>!Array.isArray(r)||r.length!==b.columns.length||r.some((x:unknown)=>!(text(x)||finite(x)))))return null;}
  else if(b.type==='checklist'){if(!Array.isArray(b.items)||!b.items.length||b.items.length>20||b.items.some((i:any)=>!text(i.text,160)||typeof i.done!=='boolean'))return null;}
  else if(b.type==='calculator'){if(![b.min,b.max,b.step,b.value,b.multiplier,b.offset].every(finite)||b.max<=b.min||b.step<=0||b.value<b.min||b.value>b.max||!text(b.label,80)||!text(b.resultLabel,80)||!text(b.unit,15))return null;}
  else if(b.type==='progress'){if(!text(b.label,80)||!finite(b.value)||!finite(b.total)||b.total<=0||b.total>1e12||b.value<0||b.value>b.total||!text(b.unit||'',15))return null;}
  else if(b.type==='text'){if(!text(b.text))return null;}else return null;
 }return v;}catch{return null;}
}
export const formatNumber=(value:number)=>new Intl.NumberFormat('en',{maximumFractionDigits:2}).format(value);
export function calculate(block:Extract<VisualBlock,{type:'calculator'}>,input:number){return Math.min(block.max,Math.max(block.min,input))*block.multiplier+block.offset;}
