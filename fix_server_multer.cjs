const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

let newServerLogic = `
  app.post("/api/transcribe", upload.single('video'), async (req, res) => {
    let tempFilePath = null;
    try {
      const { language, mimeType } = req.body;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: "No video file provided." });
      }
      
      tempFilePath = file.path;
      console.log(\`[Transcribe] Saved file: \${tempFilePath} (\${mimeType})\`);
`;

code = code.replace(
  /app\.post\("\/api\/transcribe", async \(req, res\) => \{[\s\S]*?console\.log\(\`\[Transcribe\] Saved file: \$\{tempFilePath\} \(\$\{mimeType\}\)\`\);/,
  newServerLogic.trim()
);

fs.writeFileSync('server.ts', code);
