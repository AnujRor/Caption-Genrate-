const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.tsx', 'utf8');

code = code.replace(
  "const t = videoRef.current.currentTime;",
  "const t = videoRef.current.currentTime + 0.15;"
);

// We need to fix the canvas rendering time as well
code = code.replace(
  "const currentT = video.currentTime;",
  "const currentT = video.currentTime + 0.15;"
);

fs.writeFileSync('src/components/Editor.tsx', code);
