const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  `model: "gemini-2.5-pro",`,
  `model: "gemini-3.1-pro-preview",`
);

fs.writeFileSync('server.ts', code);
