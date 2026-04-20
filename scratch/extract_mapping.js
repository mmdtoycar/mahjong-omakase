const fs = require('fs');
const filePath = 'external_xdean/src/tools/guobiao/core/fan.ts';
const content = fs.readFileSync(filePath, 'utf-8');

// export const YiSeSiBuGao = new Fan({ ... name: '一色四步高' ... })
const regex = /export const (\w+) = new Fan\({\s*score:\s*\d+,\s*name:\s*['"](.+?)['"]/g;
const mapping = {};
let match;
while ((match = regex.exec(content)) !== null) {
    mapping[match[1]] = match[2];
}

fs.writeFileSync('xdean_mapping.json', JSON.stringify(mapping, null, 2));
console.log(`Extracted mapping for ${Object.keys(mapping).length} fans.`);
