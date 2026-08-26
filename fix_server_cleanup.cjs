const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "if (req.file && fs.existsSync(tempFilePath)) {",
  "if (tempFilePath && fs.existsSync(tempFilePath)) {"
);

fs.writeFileSync('server.ts', code);
