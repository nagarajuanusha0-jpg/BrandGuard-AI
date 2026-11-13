
const mongoose = require("mongoose");

const Submission = require("../models/Submission");
const Finding = require("../models/Finding");
const Guideline = require("../models/Guideline");

const {
  analyzeContent,
  extractDocument
} = require("../services/aiService");


// POST /api/submissions/:id/analyze
const analyzeSubmission = async (req, res) => {
  let submission;
  let previousStatus;

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID"
      });
    }

    submission = await Submission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found"
      });
    }

    const isCreator = req.user.role === "Creator";

    const isOwner =
      submission.createdBy.toString() === req.user._id.toString();

    if (
      (isCreator && !isOwner) ||
      !["Creator", "Admin", "Manager"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to analyze this submission."
      });
    }

    if (
      ![
        "Submitted",
        "Resubmitted",
        "Analysis Complete",
        "Needs Changes"
      ].includes(submission.status)
    ) {
      return res.status(400).json({
        success: false,
        message: "This submission cannot be analyzed in its current status."
      });
    }

    previousStatus = submission.status;

    const revisionNumber = Number(submission.currentRevision || 1);
    const previousRevisionNumber = revisionNumber - 1;

    submission.status = "Analyzing";
    await submission.save();


    // 1. EXTRACT SUBMISSION DOCUMENT

    let content = `${submission.title}\n\n${submission.description}`;

    if (submission.attachments?.length) {
      for (const attachment of submission.attachments) {
        if (!attachment.storagePath) {
          throw new Error(
            `Stored file path is missing for ${
              attachment.originalName || "submission document"
            }.`
          );
        }

        const extracted = await extractDocument(
          attachment.storagePath,
          attachment.originalName,
          attachment.mimeType
        );

        content +=
          `\n\nSubmission Document: ${extracted.filename}\n` +
          extracted.text;
      }
    }


    // 2. RETRIEVE PREVIOUS REVISION FINDINGS

    let previousFindings = [];

    if (previousRevisionNumber >= 1) {
      const previousRecords = await Finding.find({
        submissionId: submission._id,
        revisionNumber: previousRevisionNumber
      }).lean();

      previousFindings = previousRecords.map((finding) => ({
        issue: finding.issue || "",
        severity: finding.severity || "",
        category: finding.category || "",
        source: finding.source || "",
        reason: finding.explanation || "",
        suggestion: finding.suggestedCorrection || "",
        excerpt: finding.excerpt || "",
        original_excerpt: finding.originalExcerpt || "",
        evidence_excerpt: finding.evidenceExcerpt || "",
        submitted_evidence: finding.excerpt || "",
        position: finding.position || {
          start: null,
          end: null
        },
        rule_id: finding.ruleId || ""
      }));
    }


    // 3. RETRIEVE ACTIVE GUIDELINES

    const guidelines = await Guideline.find({
      isActive: true
    }).select("title category description attachment");

    const approved_tone_rules = [];

    for (const guideline of guidelines) {
      let guidelineText = `
Category: ${guideline.category}
Guideline: ${guideline.title}
Instructions: ${guideline.description}
      `.trim();

      if (guideline.attachment?.storagePath) {
        const extracted = await extractDocument(
          guideline.attachment.storagePath,
          guideline.attachment.originalName,
          guideline.attachment.mimeType
        );

        guidelineText +=
          `\nAttached Document: ${extracted.filename}\n` +
          extracted.text;
      }

      approved_tone_rules.push(guidelineText);
    }

    console.log(
      "Active guidelines sent to AI:",
      approved_tone_rules.length
    );

    console.log(
      "Previous revision findings:",
      previousFindings.length
    );

    console.log(
      "Current revision:",
      revisionNumber
    );


    // 4. RUN AI ANALYSIS

    const aiResult = await analyzeContent({
      content,
      prohibited_terms: [],
      required_terms: [],
      approved_tone_rules,
      term_replacements: {},
      previous_findings: previousFindings,
      revision_number: revisionNumber
    });

    if (!Array.isArray(aiResult.findings)) {
      throw new Error(
        "AI service returned an invalid findings response."
      );
    }


    // 5. NORMALIZE AI FINDINGS

    const normalizedFindings = aiResult.findings.map((item) => {
      const submittedEvidence =
        item.submitted_evidence ||
        item.excerpt ||
        item.original_excerpt ||
        item.evidence_excerpt ||
        "";

      return {
        submissionId: submission._id,
        revisionNumber,

        issue: item.issue || "Content issue detected",

        severity:
          item.severity === "violation"
            ? "High"
            : item.severity === "concern"
            ? "Medium"
            : "Low",

        category: item.category || "",
        source: item.source || "",
        explanation: item.reason || "",
        suggestedCorrection: item.suggestion || "",

        excerpt: submittedEvidence,
        originalExcerpt:
          item.original_excerpt || submittedEvidence,
        evidenceExcerpt: submittedEvidence,

        confidence: item.confidence || "",
        evidenceType: item.evidence_type || "",
        ruleId: item.rule_id || "",

        position: {
          start: item.position?.start ?? null,
          end: item.position?.end ?? null
        }
      };
    });


    // 6. SAVE CURRENT REVISION FINDINGS
    // Preserve findings belonging to earlier revisions.

    const insertedFindings =
      normalizedFindings.length > 0
        ? await Finding.insertMany(normalizedFindings)
        : [];

    await Finding.deleteMany({
      submissionId: submission._id,
      revisionNumber,
      ...(insertedFindings.length > 0
        ? {
            _id: {
              $nin: insertedFindings.map(
                (finding) => finding._id
              )
            }
          }
        : {})
    });


    // 7. UPDATE LATEST ANALYSIS INFORMATION

    submission.status = "Analysis Complete";

    submission.complianceScore =
      aiResult.compliance_score !== undefined &&
      aiResult.compliance_score !== null &&
      Number.isFinite(Number(aiResult.compliance_score))
        ? Number(aiResult.compliance_score)
        : null;

    submission.analyzedAt = new Date();

    await submission.save();


    // 8. SEND COMPLETE ANALYSIS RESPONSE

    return res.status(200).json({
      success: true,
      message: "AI analysis completed successfully",

      submissionId: submission._id,
      revisionNumber,

      complianceScore: aiResult.compliance_score,
      totalIssues: normalizedFindings.length,

      findings: normalizedFindings,

      scoreBreakdown: aiResult.score_breakdown || null,
      revisionIntelligence: aiResult.revision_intelligence || null,
      summary: aiResult.summary || null
    });

  } catch (error) {
    if (submission && previousStatus) {
      submission.status = previousStatus;
      await submission.save().catch(() => {});
    }

    console.error("AI analysis error:", error.message);

    return res.status(500).json({
      success: false,
      message: "AI analysis failed",
      error: error.message
    });
  }
};


// GET /api/submissions/:id/findings
const getSubmissionFindings = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID"
      });
    }

    const submission = await Submission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found"
      });
    }

    const isOwner =
      submission.createdBy.toString() === req.user._id.toString();

    if (req.user.role === "Creator" && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "You cannot access these findings."
      });
    }

    if (
      !["Creator", "Admin", "Manager", "Reviewer"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view findings."
      });
    }

    // Return findings from the current revision only.
    const currentRevision = Number(submission.currentRevision || 1);

    const findings = await Finding.find({
      submissionId: submission._id,
      revisionNumber: currentRevision
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: findings.length,
      revisionNumber: currentRevision,
      findings
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve findings",
      error: error.message
    });
  }
};


// GET /api/findings
const getAllFindings = async (req, res) => {
  try {
    if (
      !["Creator", "Admin", "Manager", "Reviewer"].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view findings."
      });
    }

    const findings = await Finding.find()
      .populate({
        path: "submissionId",
        select: "title createdBy status currentRevision"
      })
      .sort({ createdAt: -1 });

    // Exclude findings from older revisions.
    const currentRevisionFindings = findings.filter((finding) => {
      if (!finding.submissionId) {
        return false;
      }

      return (
        Number(finding.revisionNumber || 1) ===
        Number(finding.submissionId.currentRevision || 1)
      );
    });

    const visibleFindings =
      req.user.role === "Creator"
        ? currentRevisionFindings.filter(
            (finding) =>
              finding.submissionId.createdBy.toString() ===
              req.user._id.toString()
          )
        : currentRevisionFindings;

    return res.status(200).json({
      success: true,
      count: visibleFindings.length,
      findings: visibleFindings
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve findings",
      error: error.message
    });
  }
};


module.exports = {
  analyzeSubmission,
  getSubmissionFindings,
  getAllFindings
};
