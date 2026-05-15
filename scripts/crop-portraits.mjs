// Crop card images to extract character illustration only (remove card borders)
import sharp from 'sharp';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';
import { imageSize } from 'image-size';

const IN_DIR = 'public/portraits';
const OUT_DIR = 'public/portraits-cropped';

// Files to crop (use the full-size .png when available, fallback to .jpg)
const FILES = [
  // Wei (7)
  { id: 'caocao', src: 'caocao.png' },
  { id: 'simayi', src: 'simayi.png' },
  { id: 'xiahoudun', src: 'xiahoudun.png' },
  { id: 'zhangliao', src: 'zhangliao.png' },
  { id: 'xuchu', src: 'xuchu.png' },
  { id: 'guojia', src: 'guojia.png' },
  { id: 'zhenji', src: 'zhenji.png' },
  // Shu (7)
  { id: 'liubei', src: 'liubei.png' },
  { id: 'guanyu', src: 'guanyu.png' },
  { id: 'zhangfei', src: 'zhangfei.png' },
  { id: 'zhugeliang', src: 'zhugeliang.jpg' },
  { id: 'zhaoyun', src: 'zhaoyun.jpg' },
  { id: 'machao', src: 'machao.png' },
  { id: 'huangyueying', src: 'huangyueying.png' },
  // Wu (7)
  { id: 'sunquan', src: 'sunquan.png' },
  { id: 'zhouyu', src: 'zhouyu.png' },
  { id: 'huanggai', src: 'huanggai.png' },
  { id: 'lvmeng', src: 'lvmeng.png' },
  { id: 'luxun', src: 'luxun.png' },
  { id: 'daqiao', src: 'daqiao.png' },
  { id: 'sunshangxiang', src: 'sunshangxiang.png' },
  // Qun (5)
  { id: 'huatuo', src: 'huatuo.png' },
  { id: 'lvbu', src: 'lvbu.png' },
  { id: 'diaochan', src: 'diaochan.png' },
  { id: 'zhangjiao', src: 'zhangjiao.png' },
  { id: 'yuanshao', src: 'yuanshao.png' },
];

mkdirSync(OUT_DIR, { recursive: true });

// Crop parameters: fraction of width/height to remove from each side
// Sanguosha cards: border ~6% sides, name bar ~12% top, skill text ~30% bottom
const CROP = { left: 0.06, top: 0.12, right: 0.06, bottom: 0.30 };

async function cropOne({ id, src }) {
  const inPath = join(IN_DIR, src);
  try {
    const buf = readFileSync(inPath);
    const dim = imageSize(buf);

    const left = Math.round(dim.width * CROP.left);
    const top = Math.round(dim.height * CROP.top);
    const cropWidth = dim.width - left - Math.round(dim.width * CROP.right);
    const cropHeight = dim.height - top - Math.round(dim.height * CROP.bottom);

    const outName = id + '.webp';
    const outPath = join(OUT_DIR, outName);

    await sharp(inPath)
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .webp({ quality: 85 })
      .toFile(outPath);

    const outBuf = readFileSync(outPath);
    console.log(`OK: ${id} (${dim.width}x${dim.height} → ${cropWidth}x${cropHeight}, ${(outBuf.length/1024).toFixed(0)}KB)`);
    return `/portraits-cropped/${outName}`;
  } catch (e) {
    console.log(`FAIL: ${id} (${src}) - ${e.message}`);
    // Fallback: just use the original
    return `/portraits/${src}`;
  }
}

const results = [];
for (const f of FILES) {
  const path = await cropOne(f);
  results.push({ id: f.id, path });
}
console.log(`\nCropped: ${results.filter(r => r.path.startsWith('/portraits-cropped')).length}/${FILES.length}`);

// Output mapping for updating characterDefinitions.ts
console.log('\n=== PATH MAP ===');
for (const { id, path } of results) {
  console.log(`${id}: ${path}`);
}
