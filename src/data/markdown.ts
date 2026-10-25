export type MarkdownBlock={type:'text'|'code'|'heading'|'blank';text:string;language?:string}|{type:'table';columns:string[];rows:string[][]};
export function tableCells(line:string){
 const cells:string[]=[];let cell='',escaped=false,code=false;let value=line.trim();if(value.startsWith('|'))value=value.slice(1);
 for(const char of value){if(escaped){cell+=char;escaped=false;continue;}if(char==='\\'){escaped=true;continue;}if(char==='`')code=!code;if(char==='|'&&!code){cells.push(cell.trim());cell='';}else cell+=char;}
 if(escaped)cell+='\\';if(cell.trim()||!value.endsWith('|'))cells.push(cell.trim());return cells;
}
export function markdownBlocks(text:string):MarkdownBlock[]{
 const lines=text.split('\n');const blocks:MarkdownBlock[]=[];let cursor=0;
 // Every branch advances the cursor; incomplete streamed tables/code remain finite.
 while(cursor<lines.length){
  const line=lines[cursor++]!;
  if(line.startsWith('```')){const code=[];while(cursor<lines.length&&!lines[cursor]!.startsWith('```'))code.push(lines[cursor++]!);if(cursor<lines.length)cursor++;blocks.push({type:'code',text:code.join('\n'),language:line.slice(3)});continue;}
  const next=lines[cursor];
  if(line.includes('|')&&next&&tableCells(next).length>=2&&tableCells(next).every(c=>/^:?-{3,}:?$/.test(c))){
   const columns=tableCells(line).slice(0,8),rows:string[][]=[];cursor++;
   while(cursor<lines.length&&lines[cursor]!.trim()&&lines[cursor]!.includes('|')&&!lines[cursor]!.startsWith('```')){rows.push(tableCells(lines[cursor++]!).slice(0,8));}
   blocks.push({type:'table',columns,rows});continue;
  }
  if(!line.trim()){blocks.push({type:'blank',text:''});continue;}
  const heading=line.match(/^#{1,4}\s+(.+)/);blocks.push({type:heading?'heading':'text',text:heading?.[1]||line});
 }
 return blocks;
}
