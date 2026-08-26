const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "const matches = videoBase64.match(/^data:([A-Za-z-+\\/]+);base64,(.+)$/);",
  "const matches = videoBase64.match(/^data:(.+?);base64,(.+)$/);"
);

fs.writeFileSync('server.ts', code);
