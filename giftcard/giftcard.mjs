#!/usr/bin/env node
// 賀卡產生器：node giftcard.mjs --to "收禮公司 收禮人" --from "送禮公司 送禮人" --main "開幕誌慶" [--orient landscape|portrait] [--out /tmp/giftcard]
// 輸出：<out>/<檔名>.png（黑白、雷射雕刻用、185×122mm@300dpi）＋ <檔名>-preview.jpg（LINE 預覽用）
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), (arr[i + 1] && !arr[i + 1].startsWith('--')) ? arr[i + 1] : '1']); return a; }, []));
const to = args.to || '', from = args.from || '', main = args.main || '', orient = args.orient === 'portrait' ? 'portrait' : 'landscape';
if (!main || !to) { console.error('要 --to 與 --main（--from 可空）'); process.exit(2); }
const W = orient === 'portrait' ? 1559 : 2185, H = orient === 'portrait' ? 2244 : 1441;
const outDir = args.out || '/tmp/giftcard'; fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date(); const ymd = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, '0')}${String(stamp.getDate()).padStart(2, '0')}`;
const safe = s => s.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 30);
const base = `${ymd}_賀卡_${safe(to)}_${safe(main)}${orient === 'portrait' ? '_直' : ''}`;
const tpl = 'file://' + path.resolve(path.dirname(new URL(import.meta.url).pathname), 'template.html');
const url = `${tpl}?to=${encodeURIComponent(to)}&from=${encodeURIComponent(from)}&main=${encodeURIComponent(main)}&orient=${orient}`;
const prof = '/tmp/chrome-giftcard-' + process.pid, port = 9700 + (process.pid % 100);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + prof, '--no-first-run', '--disable-gpu', '--hide-scrollbars', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms)); let targets = null;
for (let i = 0; i < 20 && !targets; i++) { await sleep(1000); try { targets = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); } catch {} }
if (!targets) { console.error('Chrome 沒起來'); process.exit(1); }
const pg = targets.find(t => t.type === 'page'); const ws = new WebSocket(pg.webSocketDebuggerUrl); let id = 0; const pend = new Map();
await new Promise(r => ws.onopen = r); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url }); await sleep(2500);
await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(()=>true)', awaitPromise: true }); await sleep(800);
const png = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
const jpg = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: W, height: H, scale: 0.4 } });
chrome.kill(); try { fs.rmSync(prof, { recursive: true, force: true }); } catch {}
const pngPath = path.join(outDir, base + '.png'), jpgPath = path.join(outDir, base + '-preview.jpg');
fs.writeFileSync(pngPath, Buffer.from(png.data, 'base64')); fs.writeFileSync(jpgPath, Buffer.from(jpg.data, 'base64'));
console.log(JSON.stringify({ ok: true, png: pngPath, preview: jpgPath, name: base, to, from, main, orient, mm: orient === 'portrait' ? '132x190' : '185x122' }));
process.exit(0);
