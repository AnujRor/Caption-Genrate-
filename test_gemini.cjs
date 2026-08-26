const { GoogleGenAI } = require("@google/genai");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    for await (const m of await ai.models.list()) {
      if (m.name.includes('gemini-2.0')) {
         console.log(m.name);
      }
    }
  } catch (e) {
    console.error(e);
  }
}
run();
