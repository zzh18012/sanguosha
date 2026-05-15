// Add local portraitUrl to remaining characters in characterDefinitions.ts
import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/data/characterDefinitions.ts', 'utf8');

const addPortrait = [
  { name: '刘备', id: 'liubei', ext: 'png' },
  { name: '关羽', id: 'guanyu', ext: 'png' },
  { name: '诸葛亮', id: 'zhugeliang', ext: 'jpg' },
  { name: '赵云', id: 'zhaoyun', ext: 'jpg' },
  { name: '黄月英', id: 'huangyueying', ext: 'png' },
  { name: '孙权', id: 'sunquan', ext: 'png' },
  { name: '吕布', id: 'lvbu', ext: 'png' },
  { name: '貂蝉', id: 'diaochan', ext: 'png' },
  { name: '张角', id: 'zhangjiao', ext: 'png' },
  { name: '袁绍', id: 'yuanshao', ext: 'png' },
];

for (const { name, id, ext } of addPortrait) {
  // Find the exact character entry by matching the name field
  // The pattern is: name: 'CharacterName', ... isRulerOption: bool
  const pattern = new RegExp(
    "(name: '" + name + "'[^}]*?isRulerOption: (?:true|false))(\\s*})",
    's'
  );
  const replacement = "$1, portraitUrl: '/portraits/" + id + "." + ext + "'$2";
  if (content.match(pattern)) {
    content = content.replace(pattern, replacement);
    console.log('OK: ' + name);
  } else {
    // Try variant with trailing comma before closing brace
    const pattern2 = new RegExp(
      "(name: '" + name + "'[^}]*?isRulerOption: (?:true|false),)(\\s*})",
      's'
    );
    if (content.match(pattern2)) {
      content = content.replace(pattern2, "$1 portraitUrl: '/portraits/" + id + "." + ext + "'$2");
      console.log('OK(v2): ' + name);
    } else {
      console.log('FAIL: ' + name);
    }
  }
}

writeFileSync('src/data/characterDefinitions.ts', content);
console.log('Done');
