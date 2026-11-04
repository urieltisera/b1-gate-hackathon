import { readFile, writeFile, copyFile } from 'node:fs/promises';
const serverPath = new URL('../src/server.js', import.meta.url);
const uiPath = new URL('../src/ui.html', import.meta.url);
function inject(src, oldText, newText, label) {
  if (src.includes(newText)) return src; // idempotent
  if (!src.includes(oldText)) throw Error(`Unexpected ${label} structure. Nothing changed; inspect manually.`);
  return src.replace(oldText, newText);
}
let server = await readFile(serverPath, 'utf8');
let ui = await readFile(uiPath, 'utf8');
const oldServer = server, oldUi = ui;
server = inject(server,
  "import { createDraftPr, probe } from './github.js';",
  "import { createDraftPr, probe } from './github.js';\nimport { museProposal } from './meta.js';", 'server import');
server = inject(server,
  "'/api/reconcile'].includes(route)",
  "'/api/reconcile', '/api/meta/propose'].includes(route)", 'server routes');
server = inject(server,
  "    if (route === '/api/propose') result = gate.propose(input.effect);",
  "    if (route === '/api/meta/propose') result = gate.propose(await museProposal(input.request));\n    if (route === '/api/propose') result = gate.propose(input.effect);", 'server handler');
ui = inject(ui,
  '<button id="propose">Proponer acción</button>',
  '<label>Meta Muse request (optional, requires MODEL_API_KEY)</label><textarea id="museRequest" placeholder="Describe a harmless demo change"></textarea><button id="musePropose">Proponer con Meta Muse</button><button id="propose">Proponer acción manual</button>', 'UI controls');
ui = inject(ui,
  "$('propose').onclick=async()=>",
  "$('musePropose').onclick=async()=>{try{const j=await api('meta/propose',{request:$('museRequest').value});$('title').value=j.effect.title;$('body').value=j.effect.body;$('content').value=j.effect.content;display(j);}catch(e){alert(e.message);}}; $('propose').onclick=async()=>", 'UI handler');
if (server !== oldServer) await copyFile(serverPath, new URL('../src/server.js.pre-meta', import.meta.url));
if (ui !== oldUi) await copyFile(uiPath, new URL('../src/ui.html.pre-meta', import.meta.url));
if (server !== oldServer) await writeFile(serverPath, server);
if (ui !== oldUi) await writeFile(uiPath, ui);
console.log('Meta proposal integration installed. Gate and GitHub executor unchanged.');
