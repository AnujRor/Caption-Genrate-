const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const newRouteLogic = `
  // API Route: Transcribe Video
  app.post("/api/transcribe", async (req, res) => {
    let tempFilePath = null;
    try {
      const { videoBase64, language, mimeType } = req.body;
      if (!videoBase64) {
        return res.status(400).json({ error: "No video file provided." });
      }

      // Parse base64
      const matches = videoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ error: "Invalid base64 video data." });
      }
      const fileBuffer = Buffer.from(matches[2], 'base64');
      const ext = mimeType.split('/')[1] || 'mp4';
      tempFilePath = path.join(uploadDir, \`temp_video_\${Date.now()}.\${ext}\`);
      fs.writeFileSync(tempFilePath, fileBuffer);

      console.log(\`[Transcribe] Saved file: \${tempFilePath} (\${mimeType})\`);

      // 1. Upload file to Gemini
      let uploadedFile = await ai.files.upload({
        file: tempFilePath,
        config: { mimeType: mimeType },
      });
`;

code = code.replace(
  /app\.post\("\/api\/transcribe", upload\.single\("video"\), async \(req, res\) => \{[\s\S]*?console\.log\(`\[Transcribe\] Uploaded file: \$\{req\.file\.path\} \(\$\{req\.file\.mimetype\}\)`\);\s*\/\/ 1\. Upload file to Gemini\s*let uploadedFile = await ai\.files\.upload\(\{\s*file: req\.file\.path,\s*config: \{ mimeType: req\.file\.mimetype \},\s*\}\);/,
  newRouteLogic.trim()
);

code = code.replace(/req\.file\.path/g, "tempFilePath");
code = code.replace(/req\.body\.language/g, "language");

fs.writeFileSync('server.ts', code);
