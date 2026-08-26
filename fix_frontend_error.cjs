const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.tsx', 'utf8');

code = code.replace(
  "throw new Error(data.error || 'Failed to generate captions');",
  "if (response.status === 429) { throw new Error('API Quota Exceeded. Please try a shorter video or wait a few minutes.'); } else { throw new Error(data.error || 'Failed to generate captions'); }"
);

fs.writeFileSync('src/components/Editor.tsx', code);
