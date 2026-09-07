const fs = require('fs');

let aiService = fs.readFileSync('server/aiService.ts', 'utf8');

const comprehensiveSchema = `
export const comprehensiveSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    distressScore: { type: Type.INTEGER, description: "A calculated distress score from 0 to 100 based on the user's situation and text." },
    level: { type: Type.STRING, description: "The distress level: MILD, MODERATE, ELEVATED, HIGH, or VERY_HIGH." },
    levelLabel: { type: Type.STRING, description: "A human-readable label for the distress level (e.g., 'Mild Routine', 'Elevated Distress')." },
    trend: { type: Type.STRING, description: "Trend compared to baseline: IMPROVING, STABLE, INCREASING, or RAPID_INCREASE." },
    primaryAction: { type: Type.STRING, description: "The single most important next step for the user." },
    supportiveMessage: { type: Type.STRING, description: "A compassionate, non-clinical supportive message acknowledging their feelings." },
    isExplicitSafetyConcern: { type: Type.BOOLEAN, description: "True if the user is in immediate physical danger." },
    factors: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "A list of contributing factors identified from the check-in." 
    },
    recommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          priority: { type: Type.STRING, description: "LOW, MEDIUM, or HIGH" },
          actionLabel: { type: Type.STRING },
          actionType: { type: Type.STRING }
        },
        required: ["category", "title", "description", "priority", "actionLabel", "actionType"]
      }
    }
  },
  required: ["distressScore", "level", "levelLabel", "trend", "primaryAction", "supportiveMessage", "isExplicitSafetyConcern", "factors", "recommendations"]
};

export async function analyzeComprehensiveCheckIn(checkInData: any, transcript: string) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  const prompt = \`
Analyze the following user check-in data and reflection transcript to generate a comprehensive personalized distress analysis and recommendations.
Do NOT diagnose any mental health condition. Use compassionate, trauma-informed language.
Be dynamic and responsive to the user's specific answers. If the user is happy, the score should be low and the message should be encouraging. If the user is sad or stressed, the score should be high and recommendations supportive.

Check-In Data:
\${JSON.stringify(checkInData, null, 2)}

Transcript: "\${transcript}"
\`;

  const response = await getAI().models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: comprehensiveSchema,
      temperature: 0.7,
    }
  });

  if (!response.text) {
    throw new Error("No response from Gemini.");
  }

  return JSON.parse(response.text);
}
`;

aiService = aiService.replace('export async function handleChat(messages: any[]) {', comprehensiveSchema + '\n\nexport async function handleChat(messages: any[]) {');

fs.writeFileSync('server/aiService.ts', aiService);

let apiRouter = fs.readFileSync('server/apiRouter.ts', 'utf8');

const analyzeComprehensiveCheckInImport = "analyzeComprehensiveCheckIn, ";
apiRouter = apiRouter.replace("import { analyzeReflection, generateCaseSummary, handleChat } from './aiService';", "import { analyzeComprehensiveCheckIn, analyzeReflection, generateCaseSummary, handleChat } from './aiService';");

const newRoute = `
router.post('/ai/comprehensive-analysis', async (req: Request, res: Response) => {
  const { checkInData, transcript } = req.body || {};
  if (!checkInData) {
    return res.status(400).json({ detail: 'Check-in data is required' });
  }

  try {
    const analysis = await analyzeComprehensiveCheckIn(checkInData, transcript || "");
    res.json(analysis);
  } catch (error: any) {
    console.error("Comprehensive analysis error:", error);
    res.status(500).json({ detail: error.message || 'Analysis failed' });
  }
});
`;

apiRouter = apiRouter.replace("router.post('/ai/analyze-reflection', async (req: Request, res: Response) => {", newRoute + "\nrouter.post('/ai/analyze-reflection', async (req: Request, res: Response) => {");

fs.writeFileSync('server/apiRouter.ts', apiRouter);

console.log("Done updating server.");
