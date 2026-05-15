// Download confirmed portrait images to public/portraits/
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const PORTRAITS = [
  { id: 'caocao', url: 'https://storage.moegirl.org.cn/moegirl/commons/c/c2/%E4%B8%89%E5%9B%BD%E6%9D%80-%E6%9B%B9%E6%93%8D-%E6%A0%87.PNG' },
  { id: 'simayi', url: 'https://storage.moegirl.org.cn/moegirl/commons/2/28/%E4%B8%89%E5%9B%BD%E6%9D%80-%E5%8F%B8%E9%A9%AC%E6%87%BF-%E6%A0%87.PNG' },
  { id: 'xiahoudun', url: 'https://storage.moegirl.org.cn/moegirl/commons/4/4d/%E4%B8%89%E5%9B%BD%E6%9D%80-%E5%A4%8F%E4%BE%AF%E6%83%87-%E6%A0%87.png' },
  { id: 'zhangliao', url: 'https://storage.moegirl.org.cn/moegirl/commons/c/c6/%E4%B8%89%E5%9B%BD%E6%9D%80-%E5%BC%A0%E8%BE%BD-%E6%A0%87.png' },
  { id: 'xuchu', url: 'https://storage.moegirl.org.cn/moegirl/commons/7/7d/%E4%B8%89%E5%9B%BD%E6%9D%80-%E8%AE%B8%E8%A4%9A-%E6%A0%87.png' },
  { id: 'guojia', url: 'https://storage.moegirl.org.cn/moegirl/commons/4/45/%E4%B8%89%E5%9B%BD%E6%9D%80-%E9%83%AD%E5%98%89-%E6%A0%87.png' },
  { id: 'zhenji', url: 'https://storage.moegirl.org.cn/moegirl/commons/7/7d/%E4%B8%89%E5%9B%BD%E6%9D%80-%E7%94%84%E5%A7%AC-%E6%A0%87.png' },
  { id: 'zhangfei', url: 'https://storage.moegirl.org.cn/moegirl/commons/a/a9/%E4%B8%89%E5%9B%BD%E6%9D%80-%E5%BC%A0%E9%A3%9E-%E6%A0%87.png' },
  { id: 'machao', url: 'https://storage.moegirl.org.cn/moegirl/commons/d/df/%E4%B8%89%E5%9B%BD%E6%9D%80-%E9%A9%AC%E8%B6%85-%E6%A0%87.png' },
  { id: 'zhouyu', url: 'https://storage.moegirl.org.cn/moegirl/commons/d/d3/%E4%B8%89%E5%9B%BD%E6%9D%80-%E5%91%A8%E7%91%9C-%E6%A0%87.png' },
  { id: 'huanggai', url: 'https://storage.moegirl.org.cn/moegirl/commons/b/b4/%E4%B8%89%E5%9B%BD%E6%9D%80-%E9%BB%84%E7%9B%96-%E6%A0%87.png' },
  { id: 'lvmeng', url: 'https://storage.moegirl.org.cn/moegirl/commons/e/ef/%E4%B8%89%E5%9B%BD%E6%9D%80-%E5%90%95%E8%92%99-%E6%A0%87.png' },
  { id: 'luxun', url: 'https://storage.moegirl.org.cn/moegirl/commons/4/42/%E4%B8%89%E5%9B%BD%E6%9D%80-%E9%99%86%E9%80%8A-%E6%A0%87.png' },
  { id: 'daqiao', url: 'https://storage.moegirl.org.cn/moegirl/commons/9/91/%E4%B8%89%E5%9B%BD%E6%9D%80-%E5%A4%A7%E4%B9%94-%E6%A0%87.png' },
  { id: 'sunshangxiang', url: 'https://storage.moegirl.org.cn/moegirl/commons/8/8d/%E4%B8%89%E5%9B%BD%E6%9D%80-%E5%AD%99%E5%B0%9A%E9%A6%99-%E6%A0%87.png' },
  { id: 'huatuo', url: 'https://storage.moegirl.org.cn/moegirl/commons/7/7c/%E4%B8%89%E5%9B%BD%E6%9D%80-%E5%8D%8E%E4%BD%97-%E6%A0%87.png' },
];

const OUT_DIR = join(import.meta.dirname, '..', 'public', 'portraits');

if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log('Created:', OUT_DIR);
}

async function download(id, url) {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    const ext = url.match(/\.(png|PNG|jpg|JPG)/)?.[1] || 'png';
    const filename = `${id}.${ext.toLowerCase()}`;
    const filepath = join(OUT_DIR, filename);
    writeFileSync(filepath, buf);
    console.log(`OK: ${id} → ${filename} (${(buf.length / 1024).toFixed(0)}KB)`);
    return `/portraits/${filename}`;
  } catch (e) {
    console.log(`FAIL: ${id} — ${e.message}`);
    return null;
  }
}

const results = [];
for (const { id, url } of PORTRAITS) {
  const localPath = await download(id, url);
  results.push({ id, localPath });
  await new Promise(r => setTimeout(r, 300));
}

console.log(`\nDownloaded: ${results.filter(r => r.localPath).length}/${PORTRAITS.length}`);
