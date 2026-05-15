// Test moegirl portrait URLs for all 25 characters
// Usage: node scripts/test-portraits.mjs

const CHARACTERS = [
  // Wei
  { id: 'caocao', name: '曹操' },
  { id: 'simayi', name: '司马懿' },
  { id: 'xiahoudun', name: '夏侯惇' },
  { id: 'zhangliao', name: '张辽' },
  { id: 'xuchu', name: '许褚' },
  { id: 'guojia', name: '郭嘉' },
  { id: 'zhenji', name: '甄姬' },
  // Shu
  { id: 'liubei', name: '刘备' },
  { id: 'guanyu', name: '关羽' },
  { id: 'zhangfei', name: '张飞' },
  { id: 'zhugeliang', name: '诸葛亮' },
  { id: 'zhaoyun', name: '赵云' },
  { id: 'machao', name: '马超' },
  { id: 'huangyueying', name: '黄月英' },
  // Wu
  { id: 'sunquan', name: '孙权' },
  { id: 'zhouyu', name: '周瑜' },
  { id: 'huanggai', name: '黄盖' },
  { id: 'lvmeng', name: '吕蒙' },
  { id: 'luxun', name: '陆逊' },
  { id: 'daqiao', name: '大乔' },
  { id: 'sunshangxiang', name: '孙尚香' },
  // Qun
  { id: 'huatuo', name: '华佗' },
  { id: 'lvbu', name: '吕布' },
  { id: 'diaochan', name: '貂蝉' },
  { id: 'zhangjiao', name: '张角' },
  { id: 'yuanshao', name: '袁绍' },
];

async function testUrl(url) {
  try {
    const resp = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(8000) });
    return { status: resp.status, location: resp.headers.get('location') };
  } catch (e) {
    return { status: 0, error: e.message };
  }
}

async function resolveStorageUrl(filepathUrl) {
  try {
    const resp = await fetch(filepathUrl, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) });
    return resp.url;
  } catch (e) {
    return null;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const results = [];

  for (const char of CHARACTERS) {
    // Try 标 (standard) portrait
    const encoded = encodeURIComponent(`三国杀-${char.name}-标.PNG`);
    const url = `https://commons.moegirl.org.cn/Special:FilePath/${encoded}`;

    console.log(`Testing: ${char.name} (${char.id})...`);

    const storageUrl = await resolveStorageUrl(url);

    if (storageUrl && storageUrl.includes('storage.moegirl.org.cn')) {
      console.log(`  OK: ${storageUrl}`);
      results.push({ ...char, portraitUrl: storageUrl, status: 'found' });
    } else if (storageUrl) {
      console.log(`  REDIRECT to: ${storageUrl}`);
      // Try with lowercase extension
      const encoded2 = encodeURIComponent(`三国杀-${char.name}-标.png`);
      const url2 = `https://commons.moegirl.org.cn/Special:FilePath/${encoded2}`;
      const storageUrl2 = await resolveStorageUrl(url2);
      if (storageUrl2 && storageUrl2.includes('storage.moegirl.org.cn')) {
        console.log(`  OK (lowercase): ${storageUrl2}`);
        results.push({ ...char, portraitUrl: storageUrl2, status: 'found_lowercase' });
      } else {
        console.log(`  NOT FOUND (redirected to: ${storageUrl})`);
        results.push({ ...char, portraitUrl: null, status: 'not_found', redirectUrl: storageUrl });
      }
    } else {
      console.log(`  FAILED`);
      results.push({ ...char, portraitUrl: null, status: 'failed' });
    }

    // Delay to avoid rate limiting
    await sleep(600);
  }

  console.log('\n=== SUMMARY ===');
  const found = results.filter(r => r.status === 'found' || r.status === 'found_lowercase');
  const missing = results.filter(r => r.status !== 'found' && r.status !== 'found_lowercase');

  console.log(`Found: ${found.length}`);
  found.forEach(r => console.log(`  ${r.id}: ${r.portraitUrl}`));

  console.log(`Missing: ${missing.length}`);
  missing.forEach(r => console.log(`  ${r.id} (${r.name}): ${r.status} ${r.redirectUrl || ''}`));
}

main().catch(console.error);
