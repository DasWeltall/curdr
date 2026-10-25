import {test} from 'node:test';
import assert from 'node:assert/strict';
import {messageInk} from '../src/data/messageColors';
import {personalProfile} from '../src/data/profile';
import {defaults,seed} from '../src/data/seed';
import {reduce} from '../src/data/reducer';
test('custom message colors select readable foregrounds and survive profile transfer',()=>{
 assert.equal(messageInk('#FFFFFF'),'#141412');assert.equal(messageInk('#000000'),'#FFFFFF');
 const profile=personalProfile({...defaults,userMessageColor:'#FFFFFF',agentMessageColor:'#000000',replyLanguage:'de'});
 assert.equal(profile.agentMessageColor,'#000000');assert.equal(profile.replyLanguage,'de');
});
test('stream snapshots replace text and replayed runs keep a single identity',()=>{
 let state=seed();
 state=reduce(state,{type:'message',data:{id:'stream',role:'agent',kind:'text',text:'Hi',streaming:true,createdAt:'now'}});
 state=reduce(state,{type:'message',data:{id:'stream',role:'agent',kind:'text',text:'Hi there',streaming:false,createdAt:'now'}});
 const run={id:'run',channel:'main',status:'working',detail:'Searching',startedAt:'now',updatedAt:'now',activities:[]};
 state=reduce(reduce(state,{type:'run',data:run}),{type:'run',data:{...run,status:'completed'}});
 assert.equal(state.messages.length,1);assert.equal(state.messages[0]?.streaming,false);assert.equal(state.runs?.length,1);assert.equal(state.runs?.[0]?.status,'completed');
});
