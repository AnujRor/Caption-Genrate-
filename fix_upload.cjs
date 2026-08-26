const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.tsx', 'utf8');

// Replace the formData upload with a base64 JSON upload
const newUploadLogic = `
      // Read file as base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(currentProject.videoBlob);
      });
      const base64Data = await base64Promise;

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          videoBase64: base64Data,
          language: selectedLanguage,
          mimeType: currentProject.videoBlob.type
        }),
      });
`;

code = code.replace(
  /const formData = new FormData\(\);[\s\S]*?body: formData,\n\s*\}\);/,
  newUploadLogic.trim()
);

fs.writeFileSync('src/components/Editor.tsx', code);
