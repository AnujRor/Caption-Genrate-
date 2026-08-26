const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.tsx', 'utf8');

code = code.replace(
  "method: 'POST',",
  "method: 'POST',\n        credentials: 'include',"
);

fs.writeFileSync('src/components/Editor.tsx', code);
