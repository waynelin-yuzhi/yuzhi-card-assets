#!/usr/bin/env node
// 賀卡產生器：node giftcard.mjs --to "收禮人" --from "送禮人" --main "主句" [--sub "副句"] [--mode print|laser] [--out /tmp/giftcard]
// print（預設）＝照 Express「送禮盆栽祝賀卡片」：去字底圖 assets/bg-landscape.png＋文鼎圓體 B5（Adobe Fonts 本機同步）；laser＝底圖轉黑白、字改純黑
// 輸出：<out>/<檔名>.png（2400×1808、4:3）＋ <檔名>-preview.jpg（核可卡預覽用）
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), (arr[i + 1] && !arr[i + 1].startsWith('--')) ? arr[i + 1] : '1']); return a; }, []));
const to = args.to || '', from = args.from || '', main = args.main || '', sub = args.sub || '', orient = 'landscape', mode = args.mode === 'laser' ? 'laser' : 'print';
if (!main || !to) { console.error('要 --to 與 --main（--from 可空）'); process.exit(2); }
const W = 2400, H = 1808;   // 底圖 4:3（照 Express 範例）
const outDir = args.out || '/tmp/giftcard'; fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date(); const ymd = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, '0')}${String(stamp.getDate()).padStart(2, '0')}`;
const safe = s => s.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 30);
const base = `${ymd}_賀卡_${safe(to)}_${safe(main)}${mode === 'laser' ? '_雷射' : ''}`;
const tpl = 'file://' + path.resolve(path.dirname(new URL(import.meta.url).pathname), 'template.html');
// 字型：文鼎圓體 B5（AR YuanB5Std MD）＝Express 範例用的字；由 Adobe Fonts 同步在本機 CoreSync（檔名會變、用 PostScript 名找）
import { execFileSync } from 'node:child_process';
function findFont(ps) {
  const dir = path.join(process.env.HOME, 'Library/Application Support/Adobe/CoreSync/plugins/livetype');
  const walk = d => { let out = []; try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) out = out.concat(walk(p)); else if (/\.(otf|ttf)$/i.test(e.name)) out.push(p); } } catch {} return out; };
  for (const f of walk(dir)) { try { const n = execFileSync('fc-scan', ['--format', '%{postscriptname}', f], { encoding: 'utf8' }).trim(); if (n === ps) return f; } catch {} }
  return '';
}
const fontPath = findFont('ARYuanB5Std-MD');
if (!fontPath && !args['allow-fallback']) { console.error(JSON.stringify({ ok: false, error: 'font_missing', detail: '找不到文鼎圓體 B5（AR YuanB5Std）：開 Creative Cloud、確認 Adobe Fonts 已啟用這套字再重跑' })); process.exit(3); }
const url = `${tpl}?to=${encodeURIComponent(to)}&from=${encodeURIComponent(from)}&main=${encodeURIComponent(main)}&sub=${encodeURIComponent(sub)}&mode=${mode}&font=${encodeURIComponent(fontPath ? 'file://' + fontPath : '')}`;
const prof = '/tmp/chrome-giftcard-' + process.pid, port = 9700 + (process.pid % 100);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + prof, '--no-first-run', '--disable-gpu', '--hide-scrollbars', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms)); let targets = null;
for (let i = 0; i < 20 && !targets; i++) { await sleep(1000); try { targets = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); } catch {} }
if (!targets) { console.error('Chrome 沒起來'); process.exit(1); }
const pg = targets.find(t => t.type === 'page'); const ws = new WebSocket(pg.webSocketDebuggerUrl); let id = 0; const pend = new Map();
await new Promise(r => ws.onopen = r); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url }); await sleep(3500);
await send('Runtime.evaluate', { expression: "new Promise(r=>{const t=()=>document.body.getAttribute('data-ready')?r(true):setTimeout(t,100);t();})", awaitPromise: true }); await sleep(400);
const png = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
const jpg = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: W, height: H, scale: 0.4 } });
chrome.kill(); try { fs.rmSync(prof, { recursive: true, force: true }); } catch {}
const pngPath = path.join(outDir, base + '.png'), jpgPath = path.join(outDir, base + '-preview.jpg');
fs.writeFileSync(pngPath, Buffer.from(png.data, 'base64')); fs.writeFileSync(jpgPath, Buffer.from(jpg.data, 'base64'));
console.log(JSON.stringify({ ok: true, png: pngPath, preview: jpgPath, name: base, to, from, main, sub, mode, px: `${W}x${H}`, font: fontPath ? 'AR YuanB5Std' : 'Huninn(替代)' }));
process.exit(0);
