/** Reject replayed/stale packets, while allowing a restarted gateway's snapshot. */
export class StreamCursor {
 private sequence=-1;private source='';private retired=new Set<string>();
 accept(event:{type:string},id:string|null){
  if(!id)return true;
  const match=id.match(/^(?:([a-f0-9]{32}):)?([0-9]+)$/);if(!match)return true;
  const source=match[1]||'legacy',sequence=Number(match[2]);if(!Number.isSafeInteger(sequence))return false;
  if(source!==this.source){
   if(this.retired.has(source)||this.source&&event.type!=='snapshot')return false;
   if(this.source)this.retired.add(this.source);this.source=source;this.sequence=-1;
  }
  if(sequence<=this.sequence)return false;
  this.sequence=sequence;return true;
 }
}
