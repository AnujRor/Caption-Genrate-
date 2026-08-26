const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.tsx', 'utf8');

code = code.replace(/video\.currentTime \+ 0\.35/g, 'video.currentTime');
code = code.replace(/videoRef\.current\.currentTime \+ 0\.35/g, 'videoRef.current.currentTime');

fs.writeFileSync('src/components/Editor.tsx', code);
