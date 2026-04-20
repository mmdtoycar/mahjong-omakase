const fs = require('fs');
const filePath = 'external_xdean/src/tools/guobiao/core/fan.test.ts';
const content = fs.readFileSync(filePath, 'utf-8');

// Pattern: expectHu(Hand.create('...', { ... }), [ ... ])
const regex = /expectHu\(\s*Hand\.create\(\s*'(.+?)'(?:\s*,\s*\{([\s\S]+?)\})?\s*\)\s*,\s*\[([\s\S]+?)\]\s*\)/g;
let match;
const rules = [];

while ((match = regex.exec(content)) !== null) {
    const hand = match[1];
    const opts = match[2] ? match[2].trim() : "";
    const fanNamesRaw = match[3];
    
    // Extract individual fan names from the array [Fan1, Fan2, ...]
    // They are often constants, so we just take the word characters
    const fans = fanNamesRaw.split(',').map(s => s.trim()).filter(s => s.length > 0);
    
    rules.push({ hand, opts, fans });
}

fs.writeFileSync('xdean_rules.json', JSON.stringify(rules, null, 2));
console.log(`Extracted ${rules.length} rule cases.`);
