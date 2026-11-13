
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

import { apiRequest, getSavedUser } from '../services/api';

export default function SubmitContent() {
  const navigate = useNavigate();
  const location = useLocation();

  const user = getSavedUser();
  const role = user?.role || 'Creator';

  const selectedSubmissionId = location.state?.submissionId;
  const isEditing = Boolean(selectedSubmissionId);

  const [formData, setFormData] = useState({
    title: '',
    contentType: '',
    description: '',
    content: ''
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [existingAttachment, setExistingAttachment] = useState(null);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSubmission, setLoadingSubmission] = useState(isEditing);

  // LOAD EXISTING SUBMISSION
  useEffect(() => {
    if (!selectedSubmissionId) return;

    const loadSubmission = async () => {
      try {
        const response = await apiRequest(
          `/submissions/${selectedSubmissionId}`
        );

        if (!response.success || !response.data) {
          throw new Error('Unable to load submission.');
        }

        const submission = response.data;
        const savedDescription = submission.description || '';

        // Separate the description from the original content.
        // Supports both Windows and Unix line endings.
        const contentMarker = /(?:\r?\n){2}Content:\r?\n/;
        const markerMatch = contentMarker.exec(savedDescription);

        let description = savedDescription;
        let content = '';

        if (markerMatch) {
          description = savedDescription.substring(0, markerMatch.index);
          content = savedDescription.substring(
            markerMatch.index + markerMatch[0].length
          );
        }

        const attachments = submission.attachments || [];

        if (attachments.length > 0) {
          const attachment = attachments[0];

          setExistingAttachment({
            originalName:
              attachment.originalName || 'Previously uploaded document'
          });
        }

        // Do not clear text automatically.
        setFormData({
          title: submission.title || '',
          contentType: submission.category || '',
          description,
          content
        });

      } catch (err) {
        setError(err.message || 'Unable to load submission.');
      } finally {
        setLoadingSubmission(false);
      }
    };

    loadSubmission();
  }, [selectedSubmissionId]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    setError('');
  };

  // SELECT A NEW DOCUMENT
  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;

    setError('');

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const allowedExtensions = ['pdf', 'docx', 'pptx', 'txt'];
    const extension = file.name.split('.').pop().toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      setError('Please upload a PDF, DOCX, PPTX or TXT file.');
      e.target.value = '';
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('File size must not exceed 15 MB.');
      e.target.value = '';
      return;
    }

    // A new document becomes the content source.
    setFormData(prev => ({
      ...prev,
      content: ''
    }));

    setSelectedFile(file);
  };

  // SAVE OR UPDATE SUBMISSION
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (
      !formData.title.trim() ||
      !formData.contentType ||
      !formData.description.trim()
    ) {
      setError('Please complete the title, content type and description.');
      return;
    }

    const hasTextContent = Boolean(formData.content.trim());
    const hasNewDocument = Boolean(selectedFile);
    const hasExistingDocument = Boolean(existingAttachment);

    if (
      !hasTextContent &&
      !hasNewDocument &&
      !hasExistingDocument
    ) {
      setError('Please enter content text or upload a document.');
      return;
    }

    if (hasTextContent && (hasNewDocument || hasExistingDocument)) {
      setError('Please use either content text or a document, not both.');
      return;
    }

    try {
      setLoading(true);

      const submissionData = new FormData();

      submissionData.append('title', formData.title.trim());
      submissionData.append('category', formData.contentType);

      const finalDescription = hasTextContent
        ? `${formData.description.trim()}\n\nContent:\n${formData.content.trim()}`
        : formData.description.trim();

      submissionData.append('description', finalDescription);

      // When replacing an existing document, send the new file.
      // When no replacement is selected, the existing attachment remains.
      if (selectedFile) {
        submissionData.append('file', selectedFile);
      }

      const response = await apiRequest(
        isEditing
          ? `/submissions/${selectedSubmissionId}`
          : '/submissions',
        {
          method: isEditing ? 'PATCH' : 'POST',
          body: submissionData
        }
      );

      if (!response.success) {
        throw new Error(
          response.message || 'Unable to save submission.'
        );
      }

      const submissionId =
        response.data?.id ||
        response.data?._id ||
        selectedSubmissionId;

      if (!submissionId) {
        throw new Error(
          'Submission saved, but its ID could not be retrieved.'
        );
      }

      // RUN AI ANALYSIS
      try {
        const analysisResponse = await apiRequest(
          `/submissions/${submissionId}/analyze`,
          {
            method: 'POST'
          }
        );

        if (!analysisResponse.success) {
          throw new Error(
            analysisResponse.message || 'AI analysis failed.'
          );
        }

        navigate('/findings', {
          state: {
            submissionId,
            notification: isEditing
              ? 'Submission updated and re-analyzed successfully.'
              : 'Submission created and analyzed successfully.'
          }
        });

      } catch (analysisError) {
        setError(
          `Your submission was saved, but AI analysis could not be completed: ${analysisError.message}`
        );
      }

    } catch (err) {
      setError(err.message || 'Unable to save content.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingSubmission) {
    return <div>Loading submission...</div>;
  }

  return (
    <div className="dashboard-layout">
      <Navbar />

      <div className="dashboard-body">
        <Sidebar role={role} />

        <main className="dashboard-content">

          <div className="page-header">
            <div>
              <h1>{isEditing ? 'Edit Content' : 'Submit Content'}</h1>
              <p>
                {isEditing
                  ? 'Edit your existing content or replace its document.'
                  : 'Submit text or a document for brand compliance analysis.'}
              </p>
            </div>
          </div>

          <div className="submit-content-container">

            <form
              className="submit-content-form"
              onSubmit={handleSubmit}
            >

              <div className="form-group">
                <label>Content Title *</label>

                <input
                  type="text"
                  name="title"
                  placeholder="Enter content title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Content Type *</label>

                <select
                  name="contentType"
                  value={formData.contentType}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select content type</option>
                  <option value="Social Media">Social Media</option>
                  <option value="Advertisement">Advertisement</option>
                  <option value="Marketing Campaign">Marketing Campaign</option>
                  <option value="Website Content">Website Content</option>
                  <option value="Email Campaign">Email Campaign</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Content Description *</label>

                <textarea
                  name="description"
                  placeholder="Briefly describe your content..."
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  required
                />
              </div>

              <div className="form-group">
                <label>Content Text</label>

                <textarea
                  name="content"
                  placeholder={
                    existingAttachment || selectedFile
                      ? 'A document is selected as the content source.'
                      : 'Enter or edit your existing content here...'
                  }
                  value={formData.content}
                  onChange={handleChange}
                  rows="7"
                  disabled={Boolean(existingAttachment || selectedFile)}
                />

                <p className="form-hint">
                  Edit the existing text here, or use a document as your content source.
                </p>
              </div>

              <div className="form-group">
                <label>Upload Content Document</label>

                {existingAttachment && (
                  <div className="submit-selected-file">
                    <span>
                      Current document: {existingAttachment.originalName}
                    </span>
                  </div>
                )}

                <input
                  type="file"
                  accept=".pdf,.docx,.pptx,.txt"
                  onChange={handleFileChange}
                  disabled={Boolean(formData.content.trim())}
                />

                <p className="form-hint">
                  {existingAttachment
                    ? 'Choose a new document above to replace the existing one. Leave this empty to keep the current document.'
                    : 'Accepted formats: PDF, DOCX, PPTX and TXT. Maximum size: 15 MB.'}
                </p>

                {selectedFile && (
                  <div className="submit-selected-file">
                    <span>Replacement: {selectedFile.name}</span>

                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                    >
                      Remove replacement
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <p className="submit-error">{error}</p>
              )}

              <div className="submit-form-actions">

                <button
                  type="button"
                  className="cancel-submit-btn"
                  onClick={() =>
                    navigate(
                      isEditing ? '/submissions' : '/dashboard'
                    )
                  }
                  disabled={loading}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="submit-content-btn"
                  disabled={loading}
                >
                  {loading
                    ? 'Saving & Analyzing...'
                    : isEditing
                      ? 'Save Changes & Re-analyze'
                      : 'Submit & Analyze'}
                </button>

              </div>

            </form>

          </div>

        </main>
      </div>
    </div>
  );
}
