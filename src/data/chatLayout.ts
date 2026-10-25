export const LINE_HEIGHT=24;
export const MAX_INPUT_HEIGHT=LINE_HEIGHT*5;
export function inputHeight(text:string,measured:number){
 if(!text)return LINE_HEIGHT;
 return Math.max(LINE_HEIGHT,Math.min(MAX_INPUT_HEIGHT,Math.ceil((Number.isFinite(measured)?measured:LINE_HEIGHT)/LINE_HEIGHT)*LINE_HEIGHT));
}
export function composerHeight(textHeight:number,voice:boolean,attachments:number){return (attachments?52:0)+(voice?56:Math.max(56,Math.min(MAX_INPUT_HEIGHT,textHeight)+16));}
export function isLongReply(text:string,role:'user'|'agent'){
 return text.length>(role==='agent'?360:900)||text.split('\n').length>(role==='agent'?7:16);
}
export function replyExcerpt(text:string){
 const plain=text.replace(/```[\s\S]*?(?:```|$)/g,'').split('\n').map(line=>line.trim()).filter(line=>line&&!line.startsWith('|')&&!/^[-:| ]+$/.test(line)).join(' ').replace(/[#*_`]/g,'').trim();
 const sentence=plain.match(/^.{1,220}?[.!?](?:\s|$)/)?.[0]?.trim();
 return sentence||plain.slice(0,200)+(plain.length>200?'…':'')||'Open the full answer.';
}
