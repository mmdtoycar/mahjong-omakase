import re
import json

file_path = 'external_xdean/src/tools/guobiao/core/fan.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find Fan definitions
# regex = r"new Fan\(\{.*?name: '(.*?)'.*?sample: \[(.*?)\]"
# The above is hard due to multi-line...

# Let's split by "new Fan({"
parts = content.split("new Fan({")
cases = []

for part in parts[1:]:
    # Extract name
    name_match = re.search(r"name:\s*'(.*?)'", part)
    if not name_match:
        continue
    name = name_match.group(1)
    
    # Extract sample
    if 'sample:' in part:
        # Find everything inside sample: [ ... ]
        # This is tricky with nesting, but usually it's simple
        sample_start = part.find('sample: [')
        if sample_start != -1:
            # find matching bracket
            count = 0
            start = sample_start + 8
            end = start
            for i in range(start, len(part)):
                if part[i] == '[': count += 1
                elif part[i] == ']':
                    if count == 0:
                        end = i
                        break
                    else:
                        count -= 1
            sample_content = part[start:end]
            
            # Extract Hand.create(...)
            hands = re.findall(r"Hand\.create\('(.*?)'(?:,\s*\{(.*?)\})?\)", sample_content)
            for hand_str, options in hands:
                cases.append({
                    "name": name,
                    "hand": hand_str,
                    "opts": options if options else ""
                })

with open('xdean_samples.json', 'w', encoding='utf-8') as out:
    json.dump(cases, out, indent=2, ensure_ascii=False)
