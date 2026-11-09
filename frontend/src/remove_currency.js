const fs = require('fs');
const path = require('path');

function walk(dir) {
    fs.readdirSync(dir).forEach(f => {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.jsx')) {
            let content = fs.readFileSync(p, 'utf8');
            let changed = false;

            const patterns = [
                // 'Rs. ' +
                { regex: /'Rs\.\s*'\s*\+\s*/g, replace: '' },
                // Rs.
                { regex: /Rs\.\s*/g, replace: '' },
                // '₹' +
                { regex: /'₹'\s*\+\s*/g, replace: '' },
                // ₹
                { regex: /₹\s*/g, replace: '' },
                // <><span style={{ fontFamily: 'Arial, sans-serif' }}>{"\u20B9"}</span>
                { regex: /<><span style=\{\{ fontFamily: 'Arial, sans-serif' \}\}>\{"\\u20B9"\}<\/span>\s*/g, replace: '<>' },
                // <span style={{ fontFamily: 'Arial, sans-serif' }}>{"\u20B9"}</span>
                { regex: /<span style=\{\{ fontFamily: 'Arial, sans-serif' \}\}>\{"\\u20B9"\}<\/span>\s*/g, replace: '' },
                // '?' + (if encoding messed up)
                { regex: /'â‚¹'\s*\+\s*/g, replace: '' },
                { regex: /â‚¹\s*/g, replace: '' },
                // {"\u20B9"}
                { regex: /\{"\\u20B9"\}\s*/g, replace: '' },
                // '\u20B9' +
                { regex: /'\\u20B9'\s*\+\s*/g, replace: '' },
                // \u20B9
                { regex: /\\u20B9\s*/g, replace: '' },
                // fa-rupee-sign icon replacement just in case they are used next to amounts in reports
                // { regex: /<i className="[^"]*fa-rupee-sign[^"]*"><\/i>\s*/g, replace: '' } 
                // (maybe skip icon removal unless they complain, user said "Rs.")
            ];

            patterns.forEach(ptn => {
                if (ptn.regex.test(content)) {
                    content = content.replace(ptn.regex, ptn.replace);
                    changed = true;
                }
            });

            if (changed) {
                fs.writeFileSync(p, content, 'utf8');
                console.log('Fixed:', p);
            }
        }
    });
}

walk('c:/Users/ADMIN/Documents/GitHub/glenda_vite/frontend/src/jsx/components');
