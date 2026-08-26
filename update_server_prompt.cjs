const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const newPromptSection = `      const targetLang = language || "Auto-detect";
      let languagePrompt = "Auto-detect the spoken language (e.g. Hindi, English, Hinglish, Spanish, etc.) and transcribe the spoken words accurately in their native script.";
      if (targetLang !== "Auto-detect") {
        languagePrompt = \`The spoken language is \${targetLang}. Transcribe the speech verbatim in \${targetLang} using native script (e.g. Devanagari for Hindi). Do NOT translate.\`;
      }

      // 3. Generate structured transcription with strict audio timestamps
      const prompt = \`You are an expert audio-visual subtitle transcription engine.
Listen carefully to the audio of the video and provide high-precision word-by-word timestamps that match the speaker's vocal track.

\${languagePrompt}

CRITICAL RULES FOR ACCURATE TIMING:
1. "start": The exact time in seconds when the voice begins saying the word.
2. "end": The exact time in seconds when the voice finishes saying the word.
3. Every single spoken word must be included in exact chronological order (start <= end).
4. Do not include punctuation in the "word" field.
5. Provide accurate millisecond decimal timestamps (e.g., 0.350, 0.720, 1.450).
6. If there is introductory silence or music before speech, the first word start timestamp MUST reflect when the voice actually begins.

Output ONLY a JSON array of word objects with keys: "word", "start", "end".\`;`;

code = code.replace(
  /const targetLang = language \|\| "Auto-detect";[\s\S]*?const prompt = `Transcribe the speech in this video precisely\.[\s\S]*?If there is no speech, output an empty array \[\]\.\`;/,
  newPromptSection
);

fs.writeFileSync('server.ts', code);
