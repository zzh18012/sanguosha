// Retry failed/missing character portraits with alternative patterns
const MISSING = [
  { id: 'liubei', name: '刘备', variants: ['三国杀-刘备-标'] },
  { id: 'guanyu', name: '关羽', variants: ['三国杀-关羽-标'] },
  { id: 'zhugeliang', name: '诸葛亮', variants: ['三国杀-诸葛亮-标'] },
  { id: 'zhaoyun', name: '赵云', variants: ['三国杀-赵云-标'] },
  { id: 'huangyueying', name: '黄月英', variants: ['三国杀-黄月英-标'] },
  { id: 'sunquan', name: '孙权', variants: ['三国杀-孙权-标'] },
  { id: 'zhouyu', name: '周瑜', variants: ['三国杀-周瑜-标'] },
  { id: 'huanggai', name: '黄盖', variants: ['三国杀-黄盖-标'] },
  { id: 'lvmeng', name: '吕蒙', variants: ['三国杀-吕蒙-标'] },
  { id: 'sunshangxiang', name: '孙尚香', variants: ['三国杀-孙尚香-标'] },
  { id: 'huatuo', name: '华佗', variants: ['三国杀-华佗-标'] },
  { id: 'lvbu', name: '吕布', variants: ['三国杀-吕布-标'] },
  { id: 'diaochan', name: '貂蝉', variants: ['三国杀-貂蝉-标'] },
  { id: 'zhangjiao', name: '张角', variants: ['三国杀-张角-标'] },
  { id: 'yuanshao', name: '袁绍', variants: ['三国杀-袁绍-标'] },
];

async function resolve(url) {
  try {
    const resp = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) });
    if (resp.url.includes('storage.moegirl.org.cn')) return resp.url;
    return resp.url; // redirect but not to storage
  } catch { return null; }
}

async function main() {
  for (const char of MISSING) {
    console.log(`\n${char.name} (${char.id}):`);
    for (const variant of char.variants) {
      for (const ext of ['.png', '.PNG']) {
        const filename = variant + ext;
        const encoded = encodeURIComponent(filename);
        const url = `https://commons.moegirl.org.cn/Special:FilePath/${encoded}`;
        const result = await resolve(url);
        if (result && result.includes('storage.moegirl.org.cn')) {
          console.log(`  FOUND (${ext}): ${result}`);
        } else if (result) {
          console.log(`  MISS (${ext}): redirected to ${result.substring(0, 80)}...`);
        } else {
          console.log(`  ERR (${ext})`);
        }
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }
}

main().catch(console.error);
