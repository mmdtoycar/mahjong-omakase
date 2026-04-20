const fs = require('fs');
const filePath = 'external_xdean/src/tools/guobiao/core/fan.ts';
const content = fs.readFileSync(filePath, 'utf-8');

// Debug: check first 5000 chars
// console.log(content.substring(0, 5000));

const regex = /name:\s*['"](.+?)['"]/g;
let match;
while ((match = regex.exec(content)) !== null) {
  // console.log("Found name:", match[1]);
}

// Now try with sample
const fullRegex = /name:\s*['"](.+?)['"][\s\S]+?sample:\s*\[([\s\S]+?)\]/g;
const cases = [];
while ((match = fullRegex.exec(content)) !== null) {
    const name = match[1];
    const sampleBox = match[2];
    
    // Hand.create('...', { ... })
    const handRegex = /Hand\.create\(\s*'(.+?)'(?:\s*,\s*\{([\s\S]+?)\})?\s*\)/g;
    let handMatch;
    while ((handMatch = handRegex.exec(sampleBox)) !== null) {
        cases.push({
            name,
            hand: handMatch[1],
            opts: handMatch[2] ? handMatch[2].trim() : ""
        });
    }
}

fs.writeFileSync('xdean_samples.json', JSON.stringify(cases, null, 2));
console.log(`Extracted ${cases.length} cases.`);
