const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'css', 'style.css');
const css = fs.readFileSync(cssPath, 'utf8');

// Find references to data-sibebarbg="color_2"
const regexSidebar = /\[data-sibebarbg="color_2"\][^{]*\{([^}]+)\}/g;
let match;
console.log('--- Sidebar color_2 rules ---');
while ((match = regexSidebar.exec(css)) !== null) {
    console.log(match[0].substring(0, 300));
}

// Find references to data-headerbg="color_2"
const regexHeader = /\[data-headerbg="color_2"\][^{]*\{([^}]+)\}/g;
console.log('--- Header color_2 rules ---');
while ((match = regexHeader.exec(css)) !== null) {
    console.log(match[0].substring(0, 300));
}

// Find references to data-nav-headerbg="color_2"
const regexNavHeader = /\[data-nav-headerbg="color_2"\][^{]*\{([^}]+)\}/g;
console.log('--- NavHeader color_2 rules ---');
while ((match = regexNavHeader.exec(css)) !== null) {
    console.log(match[0].substring(0, 300));
}
