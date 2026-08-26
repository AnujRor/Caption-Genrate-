const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.tsx', 'utf8');

const retryLogic = `
      const maxRetries = 3;
      let response;
      let text;
      let data;
      let lastError;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 1) {
            setLoadingText(\`Retrying... (Attempt \${attempt}/\${maxRetries})\`);
            await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
          }
          
          response = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
              videoBase64: base64Data,
              language: selectedLanguage,
              mimeType: currentProject.videoBlob.type
            }),
          });
          
          text = await response.text();
          
          try {
            data = JSON.parse(text);
          } catch (e) {
            console.error("API response was not JSON:", text.substring(0, 500));
            throw new Error("Server returned an invalid response.");
          }
          
          if (!response.ok) {
            throw new Error(data.error || 'Failed to generate captions');
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
`;

code = code.replace(
  /const response = await fetch\('\/api\/transcribe', \{[\s\S]*?throw new Error\(data\.error \|\| 'Failed to generate captions'\);\n      \}/,
  retryLogic.trim()
);

fs.writeFileSync('src/components/Editor.tsx', code);
