const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.tsx', 'utf8');

let fixedLogic = `
  const generateCaptions = async () => {
    setIsGenerating(true);
    try {
      const maxRetries = 3;
      let response;
      let text;
      let data;
      let lastError;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 1) {
            console.log(\`Retrying... (Attempt \${attempt}/\${maxRetries})\`);
            await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
          }

          const formData = new FormData();
          formData.append('video', currentProject.videoBlob);
          formData.append('language', selectedLanguage);
          formData.append('mimeType', currentProject.videoBlob.type);
                    
          response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });
          
          text = await response.text();
          
          try {
            data = JSON.parse(text);
          } catch (e) {
            console.error("API response was not JSON:", text.substring(0, 500));
            throw new Error("Server returned an invalid response.");
          }
          
          if (!response.ok) {
            if (response.status === 429) { throw new Error('API Quota Exceeded. Please try a shorter video or wait a few minutes.'); } else { throw new Error(data.error || 'Failed to generate captions'); }
          }
          
          // If we reach here, it succeeded!
          lastError = null;
          break;
        } catch (err) {
          console.error(\`Attempt \${attempt} failed:\`, err);
          lastError = err;
          if (attempt === maxRetries) {
            throw err;
          }
        }
      }
      
      // Group words into phrases
      const words = data.words || [];
`;

code = code.replace(
  /const generateCaptions = async \(\) => \{[\s\S]*?\/\/ Group words into phrases\n      const words = data\.words \|\| \[\];/,
  fixedLogic.trim()
);

fs.writeFileSync('src/components/Editor.tsx', code);
