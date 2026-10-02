import { spawn } from 'node:child_process'; import fs from 'node:fs';
const prof='/tmp/chrome-menu-'+process.pid; const port=9800+(process.pid%100);
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port='+port,'--user-data-dir='+prof,'--no-first-run','--disable-gpu','--hide-scrollbars','--window-size=2500,1686','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); let targets=null;
for (let i=0;i<20&&!targets;i++){ await sleep(1000); try { targets=await (await fetch('http://127.0.0.1:'+port+'/json')).json(); } catch {} }
const pg=targets.find(t=>t.type==='page'); const ws=new WebSocket(pg.webSocketDebuggerUrl); let id=0; const pend=new Map();
await new Promise(r=>ws.onopen=r); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);}};
const send=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}));});
await send('Page.enable'); await send('Emulation.setDeviceMetricsOverride',{width:2500,height:1686,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'file:///tmp/custmenu/menu.html'}); await sleep(6000);
await send('Runtime.evaluate',{expression:'document.fonts.ready.then(()=>true)',awaitPromise:true});
const r=await send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:2500,height:1686,scale:1}});
fs.writeFileSync('/tmp/custmenu/customer-richmenu-v1.png',Buffer.from(r.data,'base64'));
chrome.kill(); try { fs.rmSync(prof,{recursive:true,force:true}); } catch {} process.exit(0);
