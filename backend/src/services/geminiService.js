import { GoogleGenAI } from '@google/genai';

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in backend/.env');
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Generate a token-efficient Executive Quality Brief using Gemini
 */
export async function generateExecutiveBrief(audit) {
  const ai = getAiClient();

  // Pick only top critical and warning findings to save tokens
  const criticalFindings = (audit.findings || [])
    .filter(f => f.severity === 'critical')
    .slice(0, 5)
    .map(f => `${f.category.toUpperCase()}: ${f.title}`);

  const warningFindings = (audit.findings || [])
    .filter(f => f.severity === 'warning')
    .slice(0, 4)
    .map(f => `${f.category.toUpperCase()}: ${f.title}`);

  const prompt = `
You are a Principal Web Architect & QA Consultant. Analyze this website quality audit for "${audit.domain}" (${audit.url}):
- Overall Score: ${audit.scores?.overall}/100
- SEO: ${audit.scores?.seo}/100, A11y: ${audit.scores?.a11y}/100, Broken Links: ${audit.scores?.brokenLinks}/100, Mobile: ${audit.scores?.mobileReadiness}/100
- Critical Issues: ${criticalFindings.join('; ') || 'None'}
- Key Warnings: ${warningFindings.join('; ') || 'None'}

Respond in concise, valid JSON with this exact structure:
{
  "summary": "2-3 crisp sentences summarizing why the site received this score, main architectural strengths, and biggest risks (WCAG compliance, SEO visibility, or user drop-off).",
  "topRecommendations": [
    "Actionable priority #1 fix",
    "Actionable priority #2 fix",
    "Actionable priority #3 fix"
  ],
  "estimatedFixTime": "e.g., 2-4 hours or 1-2 days"
}
Output only the JSON object. No markdown code blocks.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash-lite',
    contents: prompt,
  });

  const rawText = response.text?.trim() || '{}';
  // Strip any accidental markdown formatting
  const cleanJson = rawText.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();

  try {
    const parsed = JSON.parse(cleanJson);
    return {
      summary: parsed.summary || 'Audit analysis completed.',
      topRecommendations: Array.isArray(parsed.topRecommendations) ? parsed.topRecommendations : [],
      estimatedFixTime: parsed.estimatedFixTime || '1-2 days',
      generatedAt: new Date(),
    };
  } catch {
    return {
      summary: rawText,
      topRecommendations: ['Follow standard WCAG guidelines', 'Review metadata tags', 'Fix broken hyperlinks'],
      estimatedFixTime: '1-2 days',
      generatedAt: new Date(),
    };
  }
}

/**
 * Generate specific code fix for a single finding
 */
export async function generateFindingFix(audit, finding) {
  const ai = getAiClient();

  const prompt = `
You are a Senior Frontend Engineer. Provide an exact code solution to fix this issue on ${audit.domain}:
- Finding: ${finding.title} (${finding.category})
- Description: ${finding.description}
- Affected Element / Evidence: ${finding.evidence || finding.selector || 'HTML node'}
- Selector: ${finding.selector}

Respond in concise, valid JSON with this structure:
{
  "code": "Exact corrected HTML or React JSX or CSS code snippet that fixes this issue.",
  "language": "html" or "javascript" or "css",
  "explanation": "1-2 sentence developer explanation of why this fix resolves the issue."
}
Output only the JSON object. No markdown wrapping.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash-lite',
    contents: prompt,
  });

  const rawText = response.text?.trim() || '{}';
  const cleanJson = rawText.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();

  try {
    const parsed = JSON.parse(cleanJson);
    return {
      code: parsed.code || '// See recommended fix above',
      language: parsed.language || 'html',
      explanation: parsed.explanation || finding.recommendation,
      generatedAt: new Date(),
    };
  } catch {
    return {
      code: `<!-- Recommended Fix for ${finding.title} -->\n${finding.recommendation}`,
      language: 'html',
      explanation: finding.description,
      generatedAt: new Date(),
    };
  }
}
