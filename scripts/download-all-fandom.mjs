// Download ALL 26 character portraits from Fandom wiki
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const DOWNLOADS = [
  { id: 'caocao', url: 'https://static.wikia.nocookie.net/sanguosha/images/e/e8/WEI_001.png/revision/latest?cb=1&path-prefix=zh' },
  { id: 'simayi', url: 'https://static.wikia.nocookie.net/sanguosha/images/6/69/MDTX.YANG.WEI_002.png/revision/latest?cb=1&path-prefix=zh' },
  { id: 'xiahoudun', url: 'https://static.wikia.nocookie.net/sanguosha/images/8/8e/WEI_003.png/revision/latest?cb=1&path-prefix=zh' },
  { id: 'zhangliao', url: 'https://static.wikia.nocookie.net/sanguosha/images/b/be/WEI_004.png/revision/latest?cb=1&path-prefix=zh' },
  { id: 'xuchu', url: 'https://static.wikia.nocookie.net/sanguosha/images/e/e5/WEI_005.png/revision/latest?cb=1&path-prefix=zh' },
  { id: 'guojia', url: 'https://static.wikia.nocookie.net/sanguosha/images/8/82/JX.WEI006.png/revision/latest?cb=1&path-prefix=zh' },
  { id: 'zhenji', url: 'https://static.wikia.nocookie.net/sanguosha/images/3/3f/JX.WEI007.png/revision/latest?cb=1&path-prefix=zh' },
  { id: 'liubei', url: 'https://static.wikia.nocookie.net/sanguosha/images/d/df/SHU_001.png/revision/latest?cb=1&path-prefix=zh' },
  { id: 'guanyu', url: 'https://static.wikia.nocookie.net/sanguosha/images/1/11/SHU_002.png/revision/latest?cb=1&path-prefix=zh' },
  { id: 'zhangfei', url: 'https://static.wikia.nocookie.net/sanguosha/images/5/52/SHU_003.png/revision/latest?cb=1&path-prefix=zh' },
  { id: 'zhugeliang', url: 'https://static.wikia.nocookie.net/sanguosha/images/6/65/SHU_004.jpg/revision/latest?cb=1&path-prefix=zh' },
  { id: 'zhaoyun', url: 'https://static.wikia.nocookie.net/sanguosha/images/1/1c/SHU_005.jpg/revision/latest?cb=1&path-prefix=zh' },
  { id: 'machao', url: 'https://static.wikia.nocookie.net/sanguosha/images/4/46/SHU_006.jpg/revision/latest?cb=1&path-prefix=zh' },
  { id: 'huangyueying', url: 'https://static.wikia.nocookie.net/sanguosha/images/f/f7/SHU_007_2013.png/revision/latest?cb=1&path-prefix=zh' },
  { id: 'sunquan', url: 'https://static.wikia.nocookie.net/sanguosha/images/1/15/WU_001.png/revision/latest?cb=1&path-prefix=zh' },
  { id: 'zhouyu', url: 'https://static.wikia.nocookie.net/sanguosha/images/d/d8/WU_005.jpg/revision/latest?cb=1&path-prefix=zh' },
  { id: 'huanggai', url: 'https://static.wikia.nocookie.net/sanguosha/images/5/55/WU_004.jpg/revision/latest?cb=1&path-prefix=zh' },
  { id: 'lvmeng', url: 'https://static.wikia.nocookie.net/sanguosha/images/0/00/WU_003.jpg/revision/latest?cb=1&path-prefix=zh' },
  { id: 'luxun', url: 'https://static.wikia.nocookie.net/sanguosha/images/c/cd/WU_007.jpg/revision/latest?cb=1&path-prefix=zh' },
  { id: 'daqiao', url: 'https://static.wikia.nocookie.net/sanguosha/images/8/8b/WU_006.jpg/revision/latest?cb=1&path-prefix=zh' },
  { id: 'sunshangxiang', url: 'https://static.wikia.nocookie.net/sanguosha/images/d/dd/WU_008.jpg/revision/latest?cb=1&path-prefix=zh' },
  { id: 'huatuo', url: 'https://static.wikia.nocookie.net/sanguosha/images/0/06/QUN_001.png/revision/latest?cb=1&path-prefix=zh' },
  { id: 'lvbu', url: 'https://static.wikia.nocookie.net/sanguosha/images/5/5c/QUN_002.png/revision/latest?cb=1&path-prefix=zh' },
  { id: 'diaochan', url: 'https://static.wikia.nocookie.net/sanguosha/images/a/a7/JX.QUN003.png/revision/latest?cb=1&path-prefix=zh' },
  { id: 'zhangjiao', url: 'https://static.wikia.nocookie.net/sanguosha/images/5/5a/QUN_010.png/revision/latest?cb=1&path-prefix=zh' },
  { id: 'yuanshao', url: 'https://static.wikia.nocookie.net/sanguosha/images/3/3a/QUN_004.png/revision/latest?cb=1&path-prefix=zh' },
];

const OUT_DIR = join(import.meta.dirname, '..', 'public', 'portraits');

async function download(id, url) {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const buf = Buffer.from(await resp.arrayBuffer());
    const ext = (url.match(/\.(png|jpg|jpeg)/i)?.[1] || 'png').toLowerCase();
    const filename = id + '.' + ext;
    const filepath = join(OUT_DIR, filename);
    writeFileSync(filepath, buf);
    console.log('OK: ' + id + ' -> ' + filename + ' (' + (buf.length / 1024).toFixed(0) + 'KB)');
    return '/portraits/' + filename;
  } catch (e) {
    console.log('FAIL: ' + id + ' - ' + e.message);
    return null;
  }
}

let ok = 0;
for (const { id, url } of DOWNLOADS) {
  const result = await download(id, url);
  if (result) ok++;
  await new Promise(r => setTimeout(r, 500));
}
console.log('\nDone: ' + ok + '/' + DOWNLOADS.length);
