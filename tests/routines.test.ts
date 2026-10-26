import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {routineView,routineViews} from '../src/data/routines';
test('Hermes structured schedules render as editable strings, including opened detail',()=>{
 const row=routineView({id:'hermes-brief',name:{en:'Brief'},schedule:{kind:'cron',expr:'0 8 * * *'},last_status:{state:'ok'},prompt:null});
 assert.equal(row?.name,'Routine');assert.equal(row?.schedule,'{"kind":"cron","expr":"0 8 * * *"}');assert.equal(row?.last_status,undefined);assert.equal(row?.prompt,'');
});
test('invalid routine lists and missing identities cannot crash the tab',()=>{
 assert.deepEqual(routineViews({jobs:[]}),[]);assert.deepEqual(routineViews([null,{},false]),[]);
 assert.equal(routineViews([{id:'local-morning',name:'Morning',schedule:'Daily at 08:00'}])[0]?.schedule,'Daily at 08:00');
});
