const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.tsx', 'utf8');

code = code.replace(/video\.currentTime \+ 0\.15/g, 'video.currentTime + 0.35');
code = code.replace(/videoRef\.current\.currentTime \+ 0\.15/g, 'videoRef.current.currentTime + 0.35');

fs.writeFileSync('src/components/Editor.tsx', code);
