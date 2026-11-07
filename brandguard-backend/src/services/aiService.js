const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

const analyzeContent = async ({
  content,
  prohibited_terms = [],
  required_terms = [],
  approved_tone_rules = [],
  term_replacements = {}
}) => {
  const response = await fetch(`${AI_SERVICE_URL}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      content,
      prohibited_terms,
      required_terms,
      approved_tone_rules,
      term_replacements
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || data.message || "AI service request failed"
    );
  }

  return data;
};

module.exports = { analyzeContent };