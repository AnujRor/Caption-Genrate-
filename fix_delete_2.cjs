const fs = require('fs');
let code = fs.readFileSync('src/components/ProjectList.tsx', 'utf8');

code = code.replace(
  "e.stopPropagation();",
  "e.preventDefault();\n    e.stopPropagation();"
);

fs.writeFileSync('src/components/ProjectList.tsx', code);
