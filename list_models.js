const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  const models = await ai.models.list();
  for (const m of models.models) {
    console.log(m.name);
  }
}
run();
