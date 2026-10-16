import { existsSync } from 'node:fs';
const [major,minor]=process.versions.node.split('.').map(Number);
const valid=major===22?minor>=19:major===24?minor>=11:major>=26;
const executable=process.env.REA_BROWSER_EXECUTABLE;
console.log(JSON.stringify({runtime:process.version,host:process.platform+'/'+process.arch,rea_supported_node:valid,browser_configured:!!executable,browser_path_exists:executable?existsSync(executable):null,release_pin:'rea-agents@6.5.0',note:'Host check only; does not prove REA or CDP works.'},null,2));
if(!valid)process.exitCode=2;
