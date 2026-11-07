const mongoose = require("mongoose");

const Submission = require("../models/Submission");
const Finding = require("../models/Finding");
const { analyzeContent } = require("../services/aiService");
const Guideline = require("../models/Guideline");

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
      !["Submitted", "Resubmitted", "Analysis Complete", "Needs Changes"].includes(
        submission.status
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "This submission cannot be analyzed in its current status."
      });
    }

    previousStatus = submission.status;
    submission.status = "Analyzing";
    await submission.save();

    const content = `${submission.title}\n\n${submission.description}`;

// Retrieve all active guidelines created by Admin
const guidelines = await Guideline.find({
  isActive: true
}).select("title category description");

// Convert guidelines into instructions for the AI service
const approved_tone_rules = guidelines.map((guideline) => {
  return `
Category: ${guideline.category}
Guideline: ${guideline.title}
Instructions: ${guideline.description}
  `.trim();
});

console.log("Active guidelines sent to AI:", approved_tone_rules.length);

const aiResult = await analyzeContent({
  content,
  prohibited_terms: [],
  required_terms: [],
  approved_tone_rules,
  term_replacements: {}
});

    if (!Array.isArray(aiResult.findings)) {
      throw new Error("AI service returned an invalid findings response.");
    }

    const normalizedFindings = aiResult.findings.map((item) => ({
      submissionId: submission._id,
      revisionNumber: submission.currentRevision,
      issue: item.issue || "Content issue detected",
      severity:
        item.severity === "violation" ? "High" :
        item.severity === "concern" ? "Medium" : "Low",
      source: item.source || "",
      explanation: item.reason || "",
      suggestedCorrection: item.suggestion || "",
      position: {
        start: item.position?.start ?? null,
        end: item.position?.end ?? null
      }
    }));

    // Replace findings for this revision to avoid duplicates
    await Finding.deleteMany({
      submissionId: submission._id,
      revisionNumber: submission.currentRevision
    });

    if (normalizedFindings.length > 0) {
      await Finding.insertMany(normalizedFindings);
    }

    submission.status = "Analysis Complete";
    await submission.save();

    return res.status(200).json({
      success: true,
      message: "AI analysis completed successfully",
      submissionId: submission._id,
      revisionNumber: submission.currentRevision,
      complianceScore: aiResult.compliance_score,
      totalIssues: aiResult.total_issues,
      findings: normalizedFindings
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
    const submission = await Submission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found"
      });
    }

    const isOwner =
      submission.createdBy.toString() === req.user._id.toString();

    if (
      req.user.role === "Creator" && !isOwner
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot access these findings."
      });
    }

    if (!["Creator", "Admin", "Manager", "Reviewer"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view findings."
      });
    }

    const findings = await Finding.find({
      submissionId: submission._id
    }).sort({ revisionNumber: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: findings.length,
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
    if (!["Creator", "Admin", "Manager", "Reviewer"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view findings."
      });
    }

    const findings = await Finding.find()
      .populate({
        path: "submissionId",
        select: "title createdBy status"
      })
      .sort({ createdAt: -1 });

    const visibleFindings =
      req.user.role === "Creator"
        ? findings.filter(
            (finding) =>
              finding.submissionId &&
              finding.submissionId.createdBy.toString() === req.user._id.toString()
          )
        : findings;

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