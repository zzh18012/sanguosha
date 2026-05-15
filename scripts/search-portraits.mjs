// Search for missing character portraits on moegirl
const MISSING = [
  { id: 'liubei', name: '刘备' },
  { id: 'guanyu', name: '关羽' },
  { id: 'zhugeliang', name: '诸葛亮' },
  { id: 'zhaoyun', name: '赵云' },
  { id: 'huangyueying', name: '黄月英' },
  { id: 'sunquan', name: '孙权' },
  { id: 'zhouyu', name: '周瑜' },
  { id: 'huanggai', name: '黄盖' },
  { id: 'lvbu', name: '吕布' },
  { id: 'diaochan', name: '貂蝉' },
  { id: 'zhangjiao', name: '张角' },
  { id: 'yuanshao', name: '袁绍' },
];

// Try alternate patterns: without 标, with SP, with OL, different separator
const PATTERNS = [
  (name) => `三国杀-${name}-标`,
  (name) => `三国杀_${name}_标`,
  (name) => `三国杀-${name}`,
  (name) => `三国杀_${name}`,
  (name) => `三国杀-${name}-SP`,
  (name) => `三国杀-${name}-OL`,
];

async function resolve(url) {
  try {
    const resp = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) });
    return resp.url;
  } catch { return null; }
}

async function main() {
  for (const char of MISSING) {
    console.log(`\n${char.name} (${char.id}):`);
    let found = false;
    for (const pattern of PATTERNS) {
      if (found) break;
      const base = pattern(char.name);
      for (const ext of ['.png', '.PNG', '.jpg', '.JPG']) {
        if (found) break;
        const filename = base + ext;
        const encoded = encodeURIComponent(filename);
        const url = `https://commons.moegirl.org.cn/Special:FilePath/${encoded}`;
        const result = await resolve(url);
        if (result && result.includes('storage.moegirl.org.cn')) {
          console.log(`  FOUND: ${result}`);
          found = true;
        }
        await new Promise(r => setTimeout(r, 400));
      }
    }
    if (!found) console.log('  NOT FOUND with any pattern');
  }
}

main().catch(console.error);
