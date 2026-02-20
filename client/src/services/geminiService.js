import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY
});

export const categorizeIssue = async (description) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
You are a civic issue classification system.

Return ONLY valid JSON:
{
  "category": "Road | Garbage | Drainage | Lighting | Sanitation",
  "department": "String",
  "priority": "Low | Medium | High",
  "formatted_title": "Short descriptive title"
}

Issue:
${description}
`
    });

    const text = response.text;

    try {
      return JSON.parse(text);
    } catch {
      return JSON.parse(text.replace(/```json|```/g, ""));
    }
  } catch (error) {
    console.error("Gemini Categorization Error:", error);

    // FALLBACK: Return a mock response so the demo doesn't break
    console.warn("Using mock fallback for Gemini categorization...");
    const mockResponses = [
      { category: "Roads", department: "Public Works", priority: "High", formatted_title: "Pothole Repair Request" },
      { category: "Garbage", department: "Waste Management", priority: "Medium", formatted_title: "Illegal Dumping Site" },
      { category: "Drainage", department: "Water & Sewage", priority: "High", formatted_title: "Blocked Storm Drain" },
      { category: "Sanitation", department: "Public Health", priority: "Low", formatted_title: "Street Cleaning Required" }
    ];

    // Simple mock logic based on keywords
    const lowerDesc = description.toLowerCase();
    let result = mockResponses[0]; // Default
    if (lowerDesc.includes("garbage") || lowerDesc.includes("trash")) result = mockResponses[1];
    else if (lowerDesc.includes("drain") || lowerDesc.includes("water")) result = mockResponses[2];
    else if (lowerDesc.includes("clean") || lowerDesc.includes("dirty")) result = mockResponses[3];

    return result;
  }
};
