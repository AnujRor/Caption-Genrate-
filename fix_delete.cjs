const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectList.tsx', 'utf8');

code = code.replace(
  "if (window.confirm('Are you sure you want to delete this project?')) {",
  "if (true) {"
);

fs.writeFileSync('src/components/ProjectList.tsx', code);
