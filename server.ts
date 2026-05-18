import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Route for Gemini analysis
  app.post("/api/analyze-spreadsheet", async (req, res) => {
    try {
      const { data, pricingContext } = req.body;

      if (!data) {
        return res.status(400).json({ error: "No data provided" });
      }

      const prompt = `Analyze the following spreadsheet data and map it to the application's item structure.
      
Application Pricing Context (Available Items and Sizes):
${JSON.stringify(pricingContext, null, 2)}

Spreadsheet Data (CSV-like or JSON string):
${data}

Rules:
1. Identify items, sizes, quantities, and prices (if available).
2. Map the items and sizes to the closest match in the Application Pricing Context.
3. If an item or size is not an exact match, use the most logical counterpart.
4. Return a list of items for the cart.

Output format should be a JSON array of objects with fields: item, size, qty, rate.`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                item: { type: Type.STRING, description: "The normalized name of the item from the context." },
                size: { type: Type.STRING, description: "The normalized size from the context." },
                qty: { type: Type.NUMBER, description: "The quantity of the item." },
                rate: { type: Type.NUMBER, description: "The unit price/rate for the item." },
              },
              required: ["item", "size", "qty", "rate"],
            },
          },
        },
      });

      const processedData = JSON.parse(result.text || '[]');
      res.json(processedData);
    } catch (error: any) {
      console.error("Gemini analysis error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/summarize-notes", async (req, res) => {
    try {
      const { notes } = req.body;

      if (!notes) {
        return res.status(400).json({ error: "No notes provided" });
      }

      const prompt = `Summarize the following notes into a very concise, professional, and clear single-line remark. 
      Remove any irrelevant or repetitive information.
      Ensure the summary is highly professional.
      
      Notes:
      ${notes}
      
      Output exactly one summarized sentence. No extra text.`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
      });

      const processedData = result.text.trim();
      res.json({ summary: processedData });
    } catch (error: any) {
      console.error("Gemini summary error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
