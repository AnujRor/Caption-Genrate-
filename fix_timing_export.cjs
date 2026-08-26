const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.tsx', 'utf8');

const target = `        const currentT = video.currentTime;
        const phraseIndex = currentProject.phrases.findIndex(
          (p) => currentT >= p.start && currentT <= p.end
        );`;

const replacement = `        const currentT = video.currentTime + 0.15;
        const phraseIndex = currentProject.phrases.findIndex(
          (p) => currentT >= p.start && currentT <= p.end
        );`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/Editor.tsx', code);
