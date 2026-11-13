
const fs = require("fs/promises");
const path = require("path");

const AI_SERVICE_URL = (
  process.env.AI_SERVICE_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const parseResponse = async (response, endpoint) => {
  const responseText = await response.text();

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      `AI ${endpoint} returned non-JSON response. ` +
      `HTTP ${response.status}. ` +
      `Content-Type: ${response.headers.get("content-type")}. ` +
      `Response: ${responseText.slice(0, 500)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      data.detail || data.message ||
      `AI ${endpoint} failed with HTTP ${response.status}`
    );
  }

  return data;
};

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

  const data = await parseResponse(response, "/extract");

  if (!data.success) {
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

  return await parseResponse(response, "/analyze");
};

module.exports = {
  analyzeContent,
  extractDocument
};
