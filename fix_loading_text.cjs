const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.tsx', 'utf8');
code = code.replace(/setLoadingText\(\`Retrying\.\.\. \(Attempt \$\{attempt\}\/\$\{maxRetries\}\)\`\);/g, "console.log(\`Retrying... (Attempt \${attempt}/\${maxRetries})\`);");
fs.writeFileSync('src/components/Editor.tsx', code);
