const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "languagePrompt = ` The spoken language is ${targetLang}. You MUST transcribe (and translate if necessary) the speech into the ${targetLang} language, using the correct native script/characters for ${targetLang} (e.g., Hindi MUST be in Devanagari script).`;",
  "languagePrompt = ` The spoken language is ${targetLang}. You MUST transcribe the speech EXACTLY as spoken in ${targetLang}. DO NOT translate to English. Use the native script/characters for ${targetLang} (e.g., if Hindi, MUST be in Devanagari script).`;"
);

fs.writeFileSync('server.ts', code);
