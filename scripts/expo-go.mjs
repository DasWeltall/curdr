import {spawn,spawnSync} from 'node:child_process';
if(spawnSync(process.execPath,['scripts/build-avatar.mjs'],{stdio:'inherit'}).status)process.exit(1);
const args=['node_modules/expo/bin/cli','start','--go',...process.argv.slice(2)];
const child=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,EXPO_NO_TELEMETRY:'1'}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));child.on('exit',code=>process.exit(code??1));
