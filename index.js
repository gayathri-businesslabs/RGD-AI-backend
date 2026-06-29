// index.js (Backend Server file)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors()); // Allows Brilliant Directories to connect to this API

// FIXED: Passed the API key configuration object explicitly to avoid the TypeError crash
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post("/api/rgd-chat", async (req, res) => {
  try {
    const { message, history, preloadedContext } = req.body;

    // Build user prompt with previous chat history so the AI remembers past answers
    let promptHistory = "";
    if (history && history.length > 0) {
      promptHistory = "Previous conversation history for context:\n" + 
        history.map(item => `${item.sender === 'user' ? 'Client' : 'RGD AI'}: ${item.text}`).join("\n") + "\n\n";
    }

    let contextNote = "";
    if (preloadedContext) {
      contextNote = `Context: The client initiated this chat by choosing these parameters:
      - Category: ${preloadedContext.category || 'Not specified'}
      - Option selected: ${preloadedContext.value || 'Not specified'}\n\n`;
    }

    const userInstructions = `
      ${contextNote}
      ${promptHistory}
      Client's latest input: "${message}"

      Analyze the input, maintain the conversational flow, and return your reply using the requested JSON format.
    `;

    const systemInstruction = `
      You are RGD AI, the expert client onboarding agent for "Really Good Developers".
      Review the client's responses and help them discover their requirements.
      Respond ONLY with raw, valid JSON matching this schema:
      {
        "status": "in_progress" | "complete",
        "aiMessage": "string containing your friendly response/question",
        "projectSummary": null | {
          "projectTitle": "string",
          "projectDescription": "string",
          "recommendedTechStack": ["string"],
          "developerSearchKeywords": ["string"]
        }
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userInstructions,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json"
      }
    });

    const outputData = JSON.parse(response.text);
    res.json({ success: true, ...outputData });

  } catch (error) {
    console.error("RGD AI Error:", error);
    res.status(500).json({ success: false, error: "Something went wrong processing your request." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`RGD AI Backend running on port ${PORT}`));