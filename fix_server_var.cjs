const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "const language = language || \"Auto-detect\";",
  "const targetLang = language || \"Auto-detect\";"
);
code = code.replace(/if \(language !== "Auto-detect"\)/g, 'if (targetLang !== "Auto-detect")');
code = code.replace(/languagePrompt = ` The spoken language is \$\{language\}\. You MUST transcribe \(and translate if necessary\) the speech into the \$\{language\} language, using the correct native script\/characters for \$\{language\} \(e\.g\., Hindi MUST be in Devanagari script\)\.`;/g, 
  "languagePrompt = ` The spoken language is ${targetLang}. You MUST transcribe (and translate if necessary) the speech into the ${targetLang} language, using the correct native script/characters for ${targetLang} (e.g., Hindi MUST be in Devanagari script).`;"
);


fs.writeFileSync('server.ts', code);
