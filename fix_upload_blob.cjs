const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.tsx', 'utf8');

// We are likely hitting a memory limitation in the browser trying to base64 encode a massive video.
// Instead of converting the video to Base64 in the browser, let's send it as a FormData Blob.

let newFetchLogic = `
          const formData = new FormData();
          formData.append('video', currentProject.videoBlob);
          formData.append('language', selectedLanguage);
          formData.append('mimeType', currentProject.videoBlob.type);
          
          response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });
`;

code = code.replace(
  /const base64Promise = new Promise[\s\S]*?body: JSON\.stringify\(\{ [\s\S]*?\}\),\n          \}\);/,
  newFetchLogic.trim()
);

fs.writeFileSync('src/components/Editor.tsx', code);
