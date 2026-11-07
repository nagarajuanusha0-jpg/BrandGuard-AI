
const Guideline = require('../models/Guideline');
const fs = require('fs/promises');

const categories = [
  'Brand Guidelines',
  'Brand Facts',
  'Terminology'
];

const allowedReaders = ['Admin', 'Manager', 'Creator', 'Reviewer'];

function safeGuideline(guideline) {
  const data = guideline.toObject();

  if (data.attachment) {
    delete data.attachment.storagePath;
  }

  return {
    ...data,
    id: data._id
  };
}

async function removeFile(attachment) {
  if (!attachment || !attachment.storagePath) return;

  try {
    await fs.unlink(attachment.storagePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('File cleanup failed:', error.message);
    }
  }
}

// GET /api/guidelines
exports.getGuidelines = async (req, res) => {
  try {
    if (!allowedReaders.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { search = '', category = '' } = req.query;

    const filter = { isActive: true };

    if (category) {
      if (!categories.includes(category)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid guideline category'
        });
      }

      filter.category = category;
    }

    if (search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const guidelines = await Guideline.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: guidelines.map(safeGuideline)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve guidelines'
    });
  }
};

// GET /api/guidelines/:id
exports.getGuidelineById = async (req, res) => {
  try {
    const guideline = await Guideline.findOne({
      _id: req.params.id,
      isActive: true
    }).populate('createdBy', 'name email');

    if (!guideline) {
      return res.status(404).json({
        success: false,
        message: 'Guideline not found'
      });
    }

    res.json({
      success: true,
      data: safeGuideline(guideline)
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Invalid guideline ID'
    });
  }
};

// POST /api/guidelines
exports.createGuideline = async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Only Admin can create guidelines'
      });
    }

    const { title, category, description } = req.body;

    if (!title?.trim() || !category || !description?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title, category and description are required'
      });
    }

    if (!categories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid guideline category'
      });
    }

    const attachment = req.file
      ? {
          fileId: req.file.filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          storagePath: req.file.path
        }
      : undefined;

    const guideline = await Guideline.create({
      title: title.trim(),
      category,
      description: description.trim(),
      attachment,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Guideline created successfully',
      data: safeGuideline(guideline)
    });
  } catch (error) {
    if (req.file) await removeFile({ storagePath: req.file.path });

    res.status(500).json({
      success: false,
      message: 'Failed to create guideline'
    });
  }
};

// PATCH /api/guidelines/:id
exports.updateGuideline = async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Only Admin can update guidelines'
      });
    }

    const guideline = await Guideline.findOne({
      _id: req.params.id,
      isActive: true
    });

    if (!guideline) {
      return res.status(404).json({
        success: false,
        message: 'Guideline not found'
      });
    }

    const { title, category, description } = req.body;

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Title cannot be empty'
        });
      }
      guideline.title = title.trim();
    }

    if (category !== undefined) {
      if (!categories.includes(category)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid guideline category'
        });
      }
      guideline.category = category;
    }

    if (description !== undefined) {
      if (!description.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Description cannot be empty'
        });
      }
      guideline.description = description.trim();
    }

    if (req.file) {
      await removeFile(guideline.attachment);

      guideline.attachment = {
        fileId: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        storagePath: req.file.path
      };
    }

    guideline.updatedBy = req.user._id;

    await guideline.save();

    res.json({
      success: true,
      message: 'Guideline updated successfully',
      data: safeGuideline(guideline)
    });
  } catch (error) {
    if (req.file) await removeFile({ storagePath: req.file.path });

    res.status(400).json({
      success: false,
      message: 'Failed to update guideline'
    });
  }
};

// DELETE /api/guidelines/:id
exports.deleteGuideline = async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Only Admin can delete guidelines'
      });
    }

    const guideline = await Guideline.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { isActive: false, updatedBy: req.user._id },
      { new: true }
    );

    if (!guideline) {
      return res.status(404).json({
        success: false,
        message: 'Guideline not found'
      });
    }

    res.json({
      success: true,
      message: 'Guideline archived successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to delete guideline'
    });
  }
};

// GET /api/files/:fileId
exports.downloadGuidelineFile = async (req, res) => {
  try {
    if (!allowedReaders.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const guideline = await Guideline.findOne({
      'attachment.fileId': req.params.fileId,
      isActive: true
    });

    if (!guideline || !guideline.attachment?.storagePath) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    res.download(
      guideline.attachment.storagePath,
      guideline.attachment.originalName
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Unable to download file'
    });
  }
};
