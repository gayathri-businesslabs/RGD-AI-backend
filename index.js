// index.js (Backend Server file)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors()); // Allows Brilliant Directories to connect to this API

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// We define a native JSON Schema structure. This physically restricts Gemini's output engine,
// guaranteeing it can only produce raw, perfectly parsed JSON and never output conversational fluff or markdown.
const responseSchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["in_progress", "complete"],
      description: "Sets to 'in_progress' while onboarding is active, and switches to 'complete' once requirements are finalized."
    },
    aiMessage: {
      type: "string",
      description: "Your consultative, expert onboarding reply or follow-up question to the client."
    },
    projectSummary: {
      type: "object",
      properties: {
        projectTitle: { 
          type: "string", 
          description: "A short, professional title for their website project." 
        },
        projectDescription: { 
          type: "string", 
          description: "A highly-detailed, beautiful 2-paragraph draft specification ready for developers to read." 
        },
        recommendedTechStack: {
          type: "array",
          items: { type: "string" },
          description: "List of recommended technologies for this specific build (e.g. React, Node.js, Shopify, etc)."
        },
        developerSearchKeywords: {
          type: "array",
          items: { type: "string" },
          description: "The primary skill tag to run directory searches on (e.g. 'React', 'CRM', 'Fintech', 'Marketplaces')."
        }
      },
      required: ["projectTitle", "projectDescription", "recommendedTechStack", "developerSearchKeywords"],
      description: "Must be null while status is 'in_progress', and fully populated ONLY when status becomes 'complete'."
    }
  },
  required: ["status", "aiMessage"]
};

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
      If the client is non-technical, translate technical jargon into clear choices like "playful", "luxurious", or "warm".
      Once you have collected their requirements, feature needs, and visual goals, transition to "complete" and output the project specifications.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userInstructions,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema // Native constraint locks Gemini into our exact structure!
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