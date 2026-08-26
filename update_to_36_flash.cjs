const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  `model: "gemini-2.0-flash",`,
  `model: "gemini-3.6-flash",`
);

fs.writeFileSync('server.ts', code);
