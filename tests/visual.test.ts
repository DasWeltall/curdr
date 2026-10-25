import test from 'node:test';
import assert from 'node:assert/strict';
import {parseVisual,calculate} from '../src/data/visual';

test('interactive visualizations accept native blocks and reject executable or malformed content',()=>{
 const v={title:'Plan',description:'Your data',blocks:[{type:'chart',kind:'line',labels:['Jan','Feb'],series:[{name:'Sales',values:[3,8]}]},{type:'calculator',label:'Units',min:0,max:10,step:1,value:2,multiplier:5,offset:3,unit:'$',resultLabel:'Total'}]};
 assert.ok(parseVisual(JSON.stringify(v)));
 assert.equal(calculate(v.blocks[1] as any,20),53);
 assert.equal(parseVisual(JSON.stringify({...v,blocks:[{type:'html',html:'<script>alert(1)</script>'}]})),null);
 assert.equal(parseVisual(JSON.stringify({...v,blocks:[{...v.blocks[0],series:[{name:'Bad',values:[1]}]}]})),null);
 assert.equal(parseVisual('x'.repeat(65537)),null);
});

import {keyboardIsVisible} from '../src/data/keyboard';
test('navigation returns after keyboard dismissal even while the input retains focus',()=>{
 assert.equal(keyboardIsVisible(840,510,true),true);
 assert.equal(keyboardIsVisible(840,840,true),false);
 assert.equal(keyboardIsVisible(840,790,true),false);
 assert.equal(keyboardIsVisible(840,510,false),false);
});
