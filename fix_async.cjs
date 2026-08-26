const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.tsx', 'utf8');

// The replacement accidentally removed the async keyword or structure.
// Let's check how the replace happened.
// Actually, it looks like it broke the outer try/catch or async boundary.

code = code.replace(
  "const handleGenerateCaptions = () => {",
  "const handleGenerateCaptions = async () => {"
);

fs.writeFileSync('src/components/Editor.tsx', code);
