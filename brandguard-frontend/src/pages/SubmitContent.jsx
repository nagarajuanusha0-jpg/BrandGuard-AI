
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSubmission, setLoadingSubmission] = useState(isEditing);

  // LOAD EXISTING SUBMISSION FOR EDITING
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

        const descriptionText = submission.description || '';
        const marker = '\n\nContent:\n';
        const markerIndex = descriptionText.indexOf(marker);

        let description = descriptionText;
        let content = '';

        if (markerIndex !== -1) {
          description = descriptionText.substring(0, markerIndex);
          content = descriptionText.substring(
            markerIndex + marker.length
          );
        }

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

  // SAVE CONTENT AND RUN AI ANALYSIS
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (
      !formData.title.trim() ||
      !formData.contentType ||
      !formData.description.trim() ||
      !formData.content.trim()
    ) {
      setError('Please complete all required fields.');
      return;
    }

    const allowedExtensions = ['pdf', 'docx', 'pptx', 'txt'];

    if (selectedFile) {
      const extension = selectedFile.name.split('.').pop().toLowerCase();

      if (!allowedExtensions.includes(extension)) {
        setError('Please upload a PDF, DOCX, PPTX or TXT file.');
        return;
      }

      if (selectedFile.size > 15 * 1024 * 1024) {
        setError('File size must not exceed 15 MB.');
        return;
      }
    }

    try {
      setLoading(true);

      const submissionData = new FormData();

      submissionData.append('title', formData.title.trim());
      submissionData.append('category', formData.contentType);

      submissionData.append(
        'description',
        `${formData.description.trim()}\n\nContent:\n${formData.content.trim()}`
      );

      if (selectedFile) {
        submissionData.append('file', selectedFile);
      }

      // CREATE OR UPDATE SUBMISSION
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
        setError(response.message || 'Unable to save submission.');
        return;
      }

      const submissionId =
        response.data?.id ||
        response.data?._id ||
        selectedSubmissionId;

      if (!submissionId) {
        setError('Submission saved, but its ID could not be retrieved.');
        return;
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

        alert(
          isEditing
            ? 'Content updated and AI re-analysis completed!'
            : 'Content submitted and AI analysis completed!'
        );

        navigate('/findings', {
          state: { submissionId }
        });

      } catch  {
        alert(
          'Your content was saved, but AI analysis could not be completed. You can check your submission and try again.'
        );

        navigate('/submissions');
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
                  ? 'Make corrections and submit your content for AI re-analysis.'
                  : 'Submit your content for brand compliance analysis.'}
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
                <label>Content Text *</label>

                <textarea
                  name="content"
                  placeholder="Enter the content you want to check..."
                  value={formData.content}
                  onChange={handleChange}
                  rows="7"
                  required
                />
              </div>

              <div className="form-group">
                <label>Upload Supporting Document (Optional)</label>

                <input
                  type="file"
                  accept=".pdf,.docx,.pptx,.txt"
                  onChange={(e) =>
                    setSelectedFile(e.target.files?.[0] || null)
                  }
                />

                <p className="form-hint">
                  Accepted formats: PDF, DOCX, PPTX and TXT.
                  Maximum size: 15 MB.
                </p>

                {selectedFile && (
                  <div className="submit-selected-file">
                    <span>{selectedFile.name}</span>

                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                    >
                      Remove
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
    isEditing ? '/findings' : '/dashboard',
    isEditing
      ? { state: { submissionId: selectedSubmissionId } }
      : {}
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
                      ? 'Save & Re-analyze'
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
