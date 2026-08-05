import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json({ limit: '20mb' }));

// Lazy GoogleGenAI client initialization
import { GoogleGenAI } from '@google/genai';

let genAIInstance: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIInstance) {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing.');
    }
    genAIInstance = new GoogleGenAI({ apiKey });
  }
  return genAIInstance;
}

/**
 * AI API Routes
 */
app.post('/api/ai/analyze-enhance', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const ai = getGenAI();
    let cleanBase64 = image;
    let mimeType = 'image/jpeg';

    if (image.includes(';base64,')) {
      const parts = image.split(';base64,');
      mimeType = parts[0].replace('data:', '') || 'image/jpeg';
      cleanBase64 = parts[1];
    }

    const promptText = `Analyze this photo as a professional photo editor and director. Return a strict JSON object with optimal photo adjustments to make the image visually striking, balanced, and aesthetic.
Requirements:
JSON schema:
{
  "brightness": integer (-50 to 50),
  "contrast": integer (-50 to 50),
  "saturation": integer (-50 to 50),
  "exposure": integer (-50 to 50),
  "warmth": integer (-50 to 50),
  "vignette": integer (0 to 80),
  "recommendedFilter": string ("Vintage" | "Cinematic" | "Noir" | "Vibrant" | "Cool" | "Warm Glow" | "Pastel" | "None"),
  "filterIntensity": integer (20 to 100),
  "explanation": string (2 sentences explaining why these tweaks improve the lighting/composition),
  "caption": string (1 creative Instagram caption for this image),
  "tags": array of 5 strings (hashtags),
  "subjectAnalysis": string (brief breakdown of subject, lighting, and mood)
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: cleanBase64 } },
            { text: promptText },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    const jsonResult = JSON.parse(text);
    return res.json({ success: true, data: jsonResult });
  } catch (err: unknown) {
    console.error('AI Analyze Enhance error:', err);
    const msg = err instanceof Error ? err.message : 'AI processing failed';
    return res.status(500).json({ error: msg });
  }
});

app.post('/api/ai/magic-edit-prompt', async (req, res) => {
  try {
    const { image, prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'User prompt instruction is required' });
    }

    const ai = getGenAI();
    let cleanBase64 = image || '';
    let mimeType = 'image/jpeg';

    if (image && image.includes(';base64,')) {
      const parts = image.split(';base64,');
      mimeType = parts[0].replace('data:', '') || 'image/jpeg';
      cleanBase64 = parts[1];
    }

    const promptText = `The user wants to transform/edit this image according to this instruction: "${prompt}".
Analyze the image and the user's intent. Return a strict JSON response specifying updated color adjustment levels and filter styling that fulfills the user's instruction.
JSON schema:
{
  "brightness": integer (-100 to 100),
  "contrast": integer (-100 to 100),
  "saturation": integer (-100 to 100),
  "exposure": integer (-100 to 100),
  "warmth": integer (-100 to 100),
  "sepia": integer (0 to 100),
  "hueShift": integer (-180 to 180),
  "vignette": integer (0 to 100),
  "blur": integer (0 to 20),
  "recommendedFilter": string ("Vintage" | "Cinematic" | "Noir" | "Cyberpunk" | "Vibrant" | "Pastel" | "Sepia" | "Invert" | "Duotone" | "None"),
  "filterIntensity": integer (0 to 100),
  "suggestedTextOverlay": string or null (if the prompt asks for text, e.g. "SUMMER VIBES"),
  "explanation": string (explanation of how these edits fulfill the prompt)
}`;

    const partsArray: unknown[] = [{ text: promptText }];
    if (cleanBase64) {
      partsArray.unshift({ inlineData: { mimeType, data: cleanBase64 } });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: partsArray as any }],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    const jsonResult = JSON.parse(text);
    return res.json({ success: true, data: jsonResult });
  } catch (err: unknown) {
    console.error('AI Magic Edit error:', err);
    const msg = err instanceof Error ? err.message : 'Magic edit failed';
    return res.status(500).json({ error: msg });
  }
});

app.post('/api/ai/generate-image', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const ai = getGenAI();
    try {
      const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '1:1',
        },
      });

      if (response.generatedImages && response.generatedImages.length > 0) {
        const base64Img = response.generatedImages[0]?.image?.imageBytes;
        if (base64Img) {
          return res.json({
            success: true,
            image: `data:image/jpeg;base64,${base64Img}`,
          });
        }
      }
    } catch (imagenErr) {
      console.warn('Imagen generation error, falling back to gemini-2.5-flash:', imagenErr);
    }

    // Fallback if imagen is unavailable: prompt gemini for an SVG or descriptive canvas
    return res.status(500).json({ error: 'Image generation service currently unavailable.' });
  } catch (err: unknown) {
    console.error('AI Generate Image error:', err);
    const msg = err instanceof Error ? err.message : 'Image generation failed';
    return res.status(500).json({ error: msg });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
