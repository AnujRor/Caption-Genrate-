const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  `let languagePrompt = " Auto-detect the language and transcribe in that language.";`,
  `let languagePrompt = " CRITICAL: Auto-detect the spoken language and transcribe it EXACTLY in its NATIVE script. DO NOT translate to English. For example, if the language is Hindi, output in Devanagari script (e.g., \\"नमस्ते\\").";`
);

code = code.replace(
  `model: "gemini-3.5-flash",`,
  `model: "gemini-2.5-pro",`
);

code = code.replace(
  /It is CRITICAL that the start and end times are perfectly accurate and tightly bound to the exact moment the word is spoken\./,
  "It is CRITICAL that the start and end times are perfectly accurate and tightly bound to the exact moment the word is spoken. The timestamps must align with the audio perfectly."
);

fs.writeFileSync('server.ts', code);
