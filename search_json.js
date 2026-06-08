const fs = require('fs');
const data = JSON.parse(fs.readFileSync('C:\\Users\\irested\\.gemini\\antigravity\\brain\\a0b5aa33-c57e-40d7-9ec4-ac63904168df\\.system_generated\\steps\\2007\\content.md', 'utf8').replace(/^[^{]*/, '').replace(/[^}]*$/, ''));
const paths = Object.keys(data.paths);
const salePaths = paths.filter(p => p.includes('sale') || p.includes('modifier') || p.includes('option'));
console.log(salePaths);
