const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: "Output a JSON array of words. Say 'Hello World'." }
          ]
        }
      ],
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              word: { type: "STRING" },
              start: { type: "NUMBER" },
              end: { type: "NUMBER" }
            },
            required: ["word", "start", "end"]
          }
        },
      }
    });
    console.log(response.text);
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
