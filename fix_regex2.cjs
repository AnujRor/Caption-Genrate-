const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const newRegexLogic = `
      // Parse base64
      let fileBuffer;
      try {
        if (videoBase64.includes('base64,')) {
          const parts = videoBase64.split('base64,');
          fileBuffer = Buffer.from(parts[1], 'base64');
        } else {
          fileBuffer = Buffer.from(videoBase64, 'base64');
        }
      } catch (e) {
        console.error("Buffer error:", e);
        return res.status(400).json({ error: "Invalid base64 video data." });
      }
`;

code = code.replace(
  /\/\/ Parse base64[\s\S]*?const fileBuffer = Buffer\.from\(matches\[2\], 'base64'\);/,
  newRegexLogic.trim()
);

fs.writeFileSync('server.ts', code);
