const Finding = require("../models/Finding");
const Review = require("../models/Review");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Submission = require("../models/Submission");
const Revision = require("../models/Revision");

// Remove private storage paths from API responses
const safeSubmission = (submission) => {
  const data = submission.toObject();

  data.id = data._id.toString();

  data.attachments = data.attachments.map((file) => ({
    fileId: file.fileId,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size
  }));

  return data;
};

const getFileMetadata = (file) => {
  if (!file) return [];

  return [{
    fileId: require("crypto").randomUUID(),
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    storagePath: file.path
  }];
};

// CREATE SUBMISSION
const createSubmission = async (req, res) => {
  try {
    const { title, description, category } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({
        success: false,
        message: "Title, description and category are required."
      });
    }

    const attachments = getFileMetadata(req.file);

    const submission = await Submission.create({
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      createdBy: req.user._id,
      status: "Submitted",
      currentRevision: 1,
      attachments,
      submittedAt: new Date()
    });

    await Revision.create({
      submissionId: submission._id,
      revisionNumber: 1,
      submittedBy: req.user._id,
      description: submission.description,
      attachments
    });

    return res.status(201).json({
      success: true,
      message: "Submission created successfully.",
      data: safeSubmission(submission)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to create submission."
    });
  }
};

// LIST SUBMISSIONS FOR ADMIN, MANAGER AND REVIEWER
const getSubmissions = async (req, res) => {
  try {
    const {
      search = "",
      status,
      category,
      page = 1,
      limit = 10
    } = req.query;

    const currentPage = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 10));

    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;

    if (search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
        { category: { $regex: search.trim(), $options: "i" } }
      ];
    }

    const [submissions, total] = await Promise.all([
      Submission.find(filter)
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * pageSize)
        .limit(pageSize),

      Submission.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: submissions.map((item) => {
        const data = safeSubmission(item);

        data.creator = item.createdBy
          ? {
              id: item.createdBy._id,
              name: item.createdBy.name
            }
          : null;

        return data;
      }),
      pagination: {
        page: currentPage,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to fetch submissions."
    });
  }
};

// CREATOR'S OWN SUBMISSIONS
const getMySubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({
      createdBy: req.user._id
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: submissions.map(safeSubmission)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to fetch your submissions."
    });
  }
};

// GET ONE SUBMISSION
const getSubmissionById = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate("createdBy", "name email");

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found."
      });
    }

    const isOwner =
      submission.createdBy._id.toString() === req.user._id.toString();

    const isAuthorizedRole = [
      "Admin",
      "Manager",
      "Reviewer"
    ].includes(req.user.role);

    if (!isOwner && !isAuthorizedRole) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view this submission."
      });
    }

    const data = safeSubmission(submission);

    data.creator = {
      id: submission.createdBy._id,
      name: submission.createdBy.name
    };

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Invalid submission ID."
    });
  }
};

// UPDATE OR RESUBMIT

const updateSubmission = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found."
      });
    }

    if (submission.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own submissions."
      });
    }

    if (![
  "Draft",
  "Submitted",
  "Resubmitted",
  "Needs Changes",
  "Analysis Complete"
].includes(submission.status)) {
      return res.status(400).json({
        success: false,
        message: "This submission cannot be edited in its current status."
      });
    }

    const { title, description, category } = req.body;

    if (title !== undefined) submission.title = title.trim();

    if (description !== undefined) {
      submission.description = description.trim();
    }

    if (category !== undefined) {
      submission.category = category.trim();
    }

    const newAttachments = getFileMetadata(req.file);

    if (newAttachments.length > 0) {
      submission.attachments = newAttachments;
    }

    submission.currentRevision += 1;
    submission.status = "Resubmitted";
    submission.submittedAt = new Date();

    await submission.save();

    await Revision.create({
      submissionId: submission._id,
      revisionNumber: submission.currentRevision,
      submittedBy: req.user._id,
      title: submission.title,
      category: submission.category,
      description: submission.description,
      attachments: submission.attachments
    });

    return res.status(200).json({
      success: true,
      message: "Submission revised successfully.",
      data: safeSubmission(submission)
    });

  } catch (error) {
    console.error("Update submission error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update submission."
    });
  }
};


// GET REVISION HISTORY
const getSubmissionRevisions = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found."
      });
    }

    const isOwner =
      submission.createdBy.toString() === req.user._id.toString();

    const isAuthorizedRole = [
      "Admin",
      "Manager",
      "Reviewer"
    ].includes(req.user.role);

    if (!isOwner && !isAuthorizedRole) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view revision history."
      });
    }

    const revisions = await Revision.find({
      submissionId: submission._id
    })
      .populate("submittedBy", "name email")
      .sort({ revisionNumber: -1 });

    const safeRevisions = revisions.map((revision) => {
      const data = revision.toObject();

      data.attachments = data.attachments.map((file) => ({
        fileId: file.fileId,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size
      }));

      return data;
    });

    return res.status(200).json({
      success: true,
      data: safeRevisions
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Unable to fetch revision history."
    });
  }
};
// DELETE SUBMISSION AND ITS RELATED RECORDS
const deleteSubmission = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID."
      });
    }

    const submission = await Submission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found."
      });
    }

    // Only the Creator who owns this submission can delete it.
    if (submission.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own submissions."
      });
    }

    // Collect current and historical uploaded documents.
    const revisions = await Revision.find({
      submissionId: submission._id
    }).select("attachments");

    const attachments = [
      ...(submission.attachments || []),
      ...revisions.flatMap(revision => revision.attachments || [])
    ];

    const uploadDirectory = path.resolve(
      process.cwd(),
      "uploads",
      "submissions"
    );

    const filePaths = [
      ...new Set(
        attachments
          .map(file => file.storagePath)
          .filter(Boolean)
      )
    ];

    // Remove associated database records.
    await Promise.all([
      Finding.deleteMany({ submissionId: submission._id }),
      Review.deleteMany({ submissionId: submission._id }),
      Revision.deleteMany({ submissionId: submission._id })
    ]);

    await Submission.findByIdAndDelete(submission._id);

    // Clean up files belonging to this upload directory only.
    for (const filePath of filePaths) {
      const resolvedPath = path.resolve(filePath);

      if (
        resolvedPath.startsWith(uploadDirectory + path.sep)
      ) {
        try {
          await fs.promises.unlink(resolvedPath);
        } catch (fileError) {
          if (fileError.code !== "ENOENT") {
            console.error(
              "Uploaded file cleanup error:",
              fileError.message
            );
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Submission and related records deleted successfully."
    });

  } catch (error) {
    console.error("Delete submission error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete submission."
    });
  }
};
module.exports = {
  createSubmission,
  getSubmissions,
  getMySubmissions,
  getSubmissionById,
  updateSubmission,
  getSubmissionRevisions,
  deleteSubmission
};