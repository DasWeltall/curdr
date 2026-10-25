import {build} from 'esbuild';
import {writeFileSync,readFileSync} from 'node:fs';
const result=await build({entryPoints:['scripts/avatar-entry.js'],bundle:true,write:false,format:'iife',target:'es2020',minify:true,legalComments:'inline'});
writeFileSync('src/vendor/avatarRuntime.ts','// Generated from third_party/avatar-studio. MIT notices: third_party/avatar-studio/LICENSE\nexport const avatarRuntime='+JSON.stringify("/*!\n"+readFileSync("third_party/avatar-studio/LICENSE","utf8")+"\n*/\n"+result.outputFiles[0].text)+';\n');
