const fs = require('fs');
const path = require('path');
function walk(dir) {
    fs.readdirSync(dir).forEach(f => {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.jsx')) {
            let content = fs.readFileSync(p, 'utf8');
            let changed = false;
            
            // Remove 'Rs. ' +
            if (content.includes("'Rs. ' +")) {
                content = content.replace(/'Rs\. '\s*\+\s*/g, '');
                changed = true;
            }
            // Remove '₹' +
            if (content.includes("'₹' +")) {
                content = content.replace(/'₹'\s*\+\s*/g, '');
                changed = true;
            }
            // Remove Rs. in template strings or raw text
            if (content.includes("Rs. ")) {
                content = content.replace(/Rs\.\s*/g, '');
                changed = true;
            }
            // Remove ₹ in template strings or raw text
            if (content.includes("₹")) {
                content = content.replace(/₹\s*/g, '');
                changed = true;
            }

            if (changed) {
                fs.writeFileSync(p, content, 'utf8');
                console.log('Fixed:', p);
            }
        }
    });
}
walk('c:/Users/ADMIN/Documents/GitHub/glenda_vite/frontend/src/jsx/components');
