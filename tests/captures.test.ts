import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {reduce} from '../src/data/reducer';
import {seed} from '../src/data/seed';
const initial=seed();
import type {AgentEvent,BrainCapture} from '../src/data/types';
test('background plans survive snapshots and progress updates without changing chat',()=>{
 const capture:BrainCapture={id:'c-123456789',text:'A thought',createdAt:'2026-10-31T12:00:00Z',status:'planning',phase:'Inspecting menu'};
 let state=reduce(initial,{type:'capture',data:capture});
 state=reduce(state,{type:'capture',data:{...capture,status:'ready',drafts:[{id:'draft',title:'One next step',sub:'Why it matters',channel:'food'}]}});
 assert.equal(state.captures?.length,1);assert.equal(state.captures?.[0]?.status,'ready');assert.deepEqual(state.messages,initial.messages);
 const restored=reduce(initial,{type:'snapshot',data:state});assert.equal(restored.captures?.[0]?.drafts?.[0]?.title,'One next step');
});
test('unknown future stream events preserve client state',()=>{
 assert.equal(reduce(initial,{type:'future-feature',data:{}} as unknown as AgentEvent),initial);
});
