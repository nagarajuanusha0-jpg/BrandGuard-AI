const fs = require("fs/promises");
const path = require("path");

const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

const extractDocument = async (filePath, filename, mimeType) => {
  if (!filePath || !filename) {
    throw new Error("Document file information is missing.");
  }

  const fileBuffer = await fs.readFile(filePath);

  if (!fileBuffer.length) {
    throw new Error("The uploaded document is empty.");
  }

  if (fileBuffer.length > 15 * 1024 * 1024) {
    throw new Error("Document exceeds the 15 MB size limit.");
  }

  const formData = new FormData();

  const fileBlob = new Blob([fileBuffer], {
    type: mimeType || "application/octet-stream"
  });

  formData.append("file", fileBlob, path.basename(filename));

  const response = await fetch(`${AI_SERVICE_URL}/extract`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(60000)
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.detail || data.message || "Document extraction failed."
    );
  }

  return data;
};


const analyzeContent = async ({
  content,
  prohibited_terms = [],
  required_terms = [],
  approved_tone_rules = [],
  term_replacements = {},
  previous_findings = [],
  revision_number = 1
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
      term_replacements,
      previous_findings,
      revision_number
    }),
    signal: AbortSignal.timeout(60000)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || data.message || "AI service request failed."
    );
  }

  return data;
};


module.exports = {
  analyzeContent,
  extractDocument
};