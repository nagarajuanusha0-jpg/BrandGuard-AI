
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadDirectory = path.join(
  process.cwd(),
  'uploads',
  'guidelines'
);

fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedTypes = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${extension}`);
  }
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const validMimes = allowedTypes[extension];

  if (!validMimes || !validMimes.includes(file.mimetype)) {
    return cb(
      new Error('Only PDF, DOC, DOCX, PPT and PPTX files are allowed.')
    );
  }

  cb(null, true);
};

const guidelineUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

module.exports = guidelineUpload;
