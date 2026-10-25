import test from 'node:test';
import assert from 'node:assert/strict';
import {inputHeight,composerHeight,isLongReply} from '../src/data/chatLayout';
import {markdownBlocks,tableCells} from '../src/data/markdown';
import {confirmedIds,pendingMessages,serializeOutbox,restoreOutbox,PendingMessage} from '../src/data/outbox';
import {StreamCursor} from '../src/data/streamCursor';
import {reduce} from '../src/data/reducer';
import {seed} from '../src/data/seed';
import type {Message} from '../src/data/types';
const local=(id:string,text='Same'):PendingMessage=>({message:{id,role:'user',kind:'text',text,channel:'main',createdAt:'2099-01-01'},baseline:['older'],status:'sending'});

test('empty composer resets despite stale native size events; voice never grows',()=>{
 assert.equal(inputHeight('',120),24);assert.equal(inputHeight('hello',NaN),24);
 assert.equal(inputHeight('long',1000),120);assert.equal(composerHeight(120,true,0),56);
 assert.equal(composerHeight(24,true,0),56);assert.equal(composerHeight(24,false,0),56);
});
test('unconfirmed messages survive HTTP completion and device/server clock skew',()=>{
 const item=local('u-123456789');assert.equal(pendingMessages([item],[]).length,1);
 const confirmed:Message={...item.message,createdAt:'2000-01-01'};
 assert.equal(pendingMessages([item],[confirmed]).length,0);
 assert.equal(restoreOutbox(serializeOutbox([item]))[0]?.status,'unknown');
});
test('legacy echo reconciliation is one-to-one for repeated text',()=>{
 const items=[local('u-123456789'),local('u-987654321')];
 const echo:Message={...items[0]!.message,id:'server-id',createdAt:'2000'};
 assert.deepEqual([...confirmedIds(items,[echo])],['u-123456789']);
 assert.equal(pendingMessages(items,[echo])[0]?.id,'u-987654321');
});
test('replayed or shorter partial never overwrites a final response/card',()=>{
 let state=reduce(seed(),{type:'message',data:{id:'r',role:'agent',kind:'text',text:'Final',createdAt:'now',streaming:false}});
 const next=reduce(state,{type:'message',data:{id:'r',role:'agent',kind:'text',text:'Fi',createdAt:'now',streaming:true}});
 assert.equal(next,state);
});
test('stream cursor rejects duplicates, stale snapshots and retired connections',()=>{
 const cursor=new StreamCursor();const one='a'.repeat(32),two='b'.repeat(32);
 assert.equal(cursor.accept({type:'snapshot'},one+':1'),true);
 assert.equal(cursor.accept({type:'message'},one+':2'),true);
 assert.equal(cursor.accept({type:'snapshot'},one+':1'),false);
 assert.equal(cursor.accept({type:'message'},one+':2'),false);
 assert.equal(cursor.accept({type:'snapshot'},two+':0'),true);
 assert.equal(cursor.accept({type:'message'},one+':99'),false);
});
test('Markdown tables terminate, preserve later paragraphs and paginate escaped pipes',()=>{
 const text='| Name | Value |\n| --- | --- |\n| A | 1 |\n| B | 2 |\n\nAfter the table.';
 const parsed=markdownBlocks(text);assert.equal(parsed[0]?.type,'table');
 assert.ok(parsed.some(b=>b.type==='text'&&b.text==='After the table.'));
 assert.deepEqual(tableCells('| a \\| b | `x|y` |'),['a | b','`x|y`']);
 const huge='| A | B |\n| --- | --- |\n'+Array(15000).fill('| a | b |').join('\n');
 assert.equal((markdownBlocks(huge)[0] as any).rows.length,15000);
 assert.equal(isLongReply(huge,'agent'),true);
 assert.ok(markdownBlocks('| A | B |\n| --').length>0);
});
