// Download missing character portraits from Fandom wiki
import { writeFileSync } from 'fs';
import { join } from 'path';

const DOWNLOADS = [
  { id: 'liubei', url: 'https://static.wikia.nocookie.net/sanguosha/images/d/df/SHU_001.png/revision/latest?cb=20130923102416&path-prefix=zh' },
  { id: 'guanyu', url: 'https://static.wikia.nocookie.net/sanguosha/images/1/11/SHU_002.png/revision/latest?cb=20260301115425&path-prefix=zh' },
  { id: 'zhugeliang', url: 'https://static.wikia.nocookie.net/sanguosha/images/6/65/SHU_004.jpg/revision/latest?cb=20170407060134&path-prefix=zh' },
  { id: 'zhaoyun', url: 'https://static.wikia.nocookie.net/sanguosha/images/1/1c/SHU_005.jpg/revision/latest?cb=20170407062755&path-prefix=zh' },
  { id: 'sunquan', url: 'https://static.wikia.nocookie.net/sanguosha/images/1/15/WU_001.png/revision/latest?cb=20130924060214&path-prefix=zh' },
  { id: 'lvbu', url: 'https://static.wikia.nocookie.net/sanguosha/images/5/5c/QUN_002.png/revision/latest?cb=20260309095308&path-prefix=zh' },
  { id: 'diaochan', url: 'https://static.wikia.nocookie.net/sanguosha/images/a/a7/JX.QUN003.png/revision/latest?cb=20210523170919&path-prefix=zh' },
  { id: 'zhangjiao', url: 'https://static.wikia.nocookie.net/sanguosha/images/5/5a/QUN_010.png/revision/latest?cb=20131005035336&path-prefix=zh' },
];

const OUT_DIR = join(import.meta.dirname, '..', 'public', 'portraits');

async function download(id, url) {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const buf = Buffer.from(await resp.arrayBuffer());
    const ext = url.match(/\.(png|jpg|jpeg)/i)?.[1] || 'png';
    const filename = id + '.' + ext.toLowerCase();
    const filepath = join(OUT_DIR, filename);
    writeFileSync(filepath, buf);
    console.log('OK: ' + id + ' -> ' + filename + ' (' + (buf.length / 1024).toFixed(0) + 'KB)');
    return '/portraits/' + filename;
  } catch (e) {
    console.log('FAIL: ' + id + ' - ' + e.message);
    return null;
  }
}

const results = [];
for (const { id, url } of DOWNLOADS) {
  const localPath = await download(id, url);
  results.push({ id, localPath });
  await new Promise(r => setTimeout(r, 500));
}

console.log('\nDownloaded: ' + results.filter(r => r.localPath).length + '/' + DOWNLOADS.length);
