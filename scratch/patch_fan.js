const fs = require('fs');
const filePath = 'frontend/src/logic/guobiao/fan.ts';
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(/if \(!isSpecial\) \{/g, 'if (true) { // removed isSpecial restriction');

let lines = code.split('\n');
let modifiedLines = [];
let addedShisan = false;

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line.includes("hasFan('七对')") && line.includes("removeFan('不求人')")) {
        line = line.replace("removeFan('不求人'); ", "");
    }
    
    modifiedLines.push(line);
    
    if (line.includes("// EXCLUSIONS")) {
        if (!addedShisan) {
            modifiedLines.push("  if (hasFan('十三幺')) { removeFan('五门齐'); removeFan('不求人'); removeFan('单钓将'); removeFan('门前清'); removeFan('混幺九'); }");
            addedShisan = true;
        }
    }
}

fs.writeFileSync(filePath, modifiedLines.join('\n'));
console.log("Patched fan.ts successfully.");
