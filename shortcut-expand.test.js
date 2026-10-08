import test from 'node:test';
import assert from 'node:assert/strict';
import {createSender as createSenderCore} from '../index.js';
import {fixture,clock,pump,seeded} from './helpers.js';
const createSender=o=>createSenderCore({random:seeded(42),...o});

function shortcutPage(d,c,{markSelected=true}={}){
 const rows=(markSelected
  ?'<li class="Ewflr" aria-selected="true"><span class="RBx9s nonIntl">Ann</span><div class="L7aBq"></div></li><li class="Ewflr" aria-selected="true"><span class="RBx9s nonIntl">Ben</span><div class="L7aBq"></div></li><li class="Ewflr" aria-selected="false"><span class="RBx9s nonIntl">Zed</span><div class="L7aBq"></div></li>'
  :'<li class="Ewflr"><span class="RBx9s nonIntl">Ann</span><div class="L7aBq"></div></li>');
 const stats={sendClicks:0};let queued=false;
 const later=fn=>{if(!queued){queued=true;c.setTimeout(()=>{queued=false;fn();},20);}};
 function show(stage){
  d.body.innerHTML=stage==='camera'?'<button class="qJKfS">Camera</button>':stage==='capture'?'<button class="fE2D5">Capture</button>':stage==='compose'?'<button class="YatIx">Send To</button>':stage==='shortcut'?'<div class="THeKv"><button class="c47Sk">Fixture group</button></div>':stage==='select'?'<button class="Y7u8A">Select</button>':stage==='send'?'<ul role="list">'+rows+'</ul><button type="submit" class="TYX6O">Send</button>':'<main>Sent</main>';
  const b=d.querySelector('button');if(!b)return;
  b.onclick=()=>{if(stage==='camera')later(()=>show('capture'));else if(stage==='capture')later(()=>show('compose'));else if(stage==='compose')later(()=>show('shortcut'));else if(stage==='shortcut')later(()=>show('select'));else if(stage==='select')later(()=>show('send'));else{stats.sendClicks++;later(()=>show('done'));}};
 }
 show('camera');return stats;
}

test('expandShortcuts reads selected members, reports them and counts them',async()=>{
 const dom=fixture(),c=clock(),errors=[],reported=[];shortcutPage(dom.window.document,c);
 const engine=createSender({document:dom.window.document,clock:c,recipients:['Fixture group'],recipientMode:'shortcut',expandShortcuts:true,actionDelay:20,loopDelay:20,targetSnapCount:1,onError:e=>errors.push(e),onShortcutMembers:m=>reported.push(m.members)});
 try{engine.start();await pump(c,12000);await engine.stop();assert.deepEqual(reported[0],['Ann','Ben']);assert.equal(engine.getState().snapsSent,2);assert.deepEqual(errors,[]);assert.equal(c.pending,0);}
 finally{await engine.dispose();dom.window.close();}
});

test('expandShortcuts off keeps legacy count and reports nothing',async()=>{
 const dom=fixture(),c=clock(),reported=[];shortcutPage(dom.window.document,c);
 const engine=createSender({document:dom.window.document,clock:c,recipients:['Fixture group'],recipientMode:'shortcut',actionDelay:20,loopDelay:20,targetSnapCount:1,onShortcutMembers:m=>reported.push(m)});
 try{engine.start();await pump(c,12000);await engine.stop();assert.equal(reported.length,0);assert.equal(engine.getState().snapsSent,1);}
 finally{await engine.dispose();dom.window.close();}
});

test('unrecognised selection falls back to legacy count and warns',async()=>{
 const dom=fixture(),c=clock(),diag=[];shortcutPage(dom.window.document,c,{markSelected:false});
 const engine=createSender({document:dom.window.document,clock:c,recipients:['Fixture group'],recipientMode:'shortcut',expandShortcuts:true,actionDelay:20,loopDelay:20,targetSnapCount:1,onDiagnostic:e=>diag.push(e)});
 try{engine.start();await pump(c,12000);await engine.stop();assert.equal(engine.getState().snapsSent,1);assert(diag.some(e=>e.event==='shortcut_members'&&e.level==='warning'));}
 finally{await engine.dispose();dom.window.close();}
});
