
import { Fragment, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { apiRequest, getSavedUser } from '../services/api';

export default function Review() {
  const navigate = useNavigate();

  const user = getSavedUser();
  const role = user?.role || 'Reviewer';
  const isReviewer = role === 'Reviewer';

  const [reviews, setReviews] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [comments, setComments] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);

  // Content viewing states
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [submissionDetails, setSubmissionDetails] = useState({});
  const [viewedIds, setViewedIds] = useState([]);
  const [detailLoadingId, setDetailLoadingId] = useState(null);
  const [detailError, setDetailError] = useState('');

  const loadReviews = useCallback(async () => {
    try {
      setError('');

      const [submissionResponse, reviewResponse] = await Promise.all([
        apiRequest('/submissions'),
        apiRequest('/reviews')
      ]);

      const submissions =
        submissionResponse.submissions ||
        submissionResponse.data ||
        [];

      const reviewHistory =
        reviewResponse.reviews ||
        reviewResponse.data ||
        [];

      const items = submissions.map(submission => {
        const previousReviews = reviewHistory.filter(review => {
          const reviewSubmissionId =
            review.submissionId?._id || review.submissionId;

          return String(reviewSubmissionId) === String(submission._id);
        });

        const latestReview = previousReviews[0];

        const isPending = [
          'Analysis Complete',
          'Pending Review',
          'Resubmitted'
        ].includes(submission.status);

        return {
          id: submission._id,
          title: submission.title || 'Untitled Submission',
          creator:
            submission.createdBy?.name ||
            submission.creator?.name ||
            'Unknown',
          date: submission.submittedAt || submission.createdAt,
          aiStatus:
            submission.status === 'Submitted'
              ? 'Not Analyzed'
              : 'Completed',
          status: isPending ? 'Pending' : submission.status,
          reviewedDate: latestReview?.reviewedAt || '',
          reviewComment: latestReview?.comment || ''
        };
      });

      setReviews(items);
    } catch (err) {
      setError(err.message || 'Unable to load review records.');
    } finally {
      setLoading(false);
    }
  }, []);

 useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
  loadReviews();
}, [loadReviews]);
  // Open actual Creator-submitted content
  const handleViewContent = async item => {
    if (selectedSubmissionId === item.id) {
      setSelectedSubmissionId(null);
      return;
    }

    setSelectedSubmissionId(item.id);
    setDetailLoadingId(item.id);
    setDetailError('');

    try {
      const response = await apiRequest(
        `/submissions/${item.id}`
      );

      const submission =
        response.submission ||
        response.data?.submission ||
        response.data ||
        response;

      // Retrieve AI findings separately.
      let findings = [];

      try {
        const findingsResponse = await apiRequest(
          `/submissions/${item.id}/findings`
        );

        const findingsData =
          findingsResponse.findings ||
          findingsResponse.data ||
          [];

        findings = Array.isArray(findingsData)
          ? findingsData
          : [];
      } catch (findingError) {
        console.error('Unable to load AI findings:', findingError);
      }

      setSubmissionDetails(prev => ({
        ...prev,
        [item.id]: {
          submission,
          findings
        }
      }));

      setViewedIds(prev =>
        prev.includes(item.id) ? prev : [...prev, item.id]
      );
    } catch (err) {
      setDetailError(
        err.message || 'Unable to load submitted content.'
      );
    } finally {
      setDetailLoadingId(null);
    }
  };

  // Extract content and description
  const getContentDetails = submission => {
    const descriptionText = submission?.description || '';

    const markerRegex = /\r?\n\r?\nContent:\r?\n/;
    const parts = descriptionText.split(markerRegex);

    const description = parts[0] || '';

    const extractedContent = parts.length > 1
      ? parts.slice(1).join('\n\nContent:\n')
      : '';

    const content =
      submission?.content ||
      extractedContent ||
      descriptionText ||
      'No submitted content is available.';

    return { description, content };
  };

  // Approve or request changes
  const handleReview = async (item, decision) => {
    if (!viewedIds.includes(item.id)) {
      alert('Please view the submitted content before reviewing.');
      return;
    }

    const comment = comments[item.id]?.trim() || '';

    if (decision === 'Needs Changes' && !comment) {
      alert('Please enter a comment explaining the requested changes.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to mark "${item.title}" as ${decision}?`
    );

    if (!confirmed) return;

    try {
      setSavingId(item.id);

      await apiRequest(`/submissions/${item.id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          comment
        })
      });

      alert(`Submission ${decision.toLowerCase()} successfully.`);

      setComments(prev => ({
        ...prev,
        [item.id]: ''
      }));

      await loadReviews();
    } catch (err) {
      alert(err.message || 'Unable to save the review.');
    } finally {
      setSavingId(null);
    }
  };

  const filteredReviews = reviews.filter(item => {
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.creator.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'All' || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const formatDate = date => {
    if (!date) return '—';

    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const pendingCount =
    reviews.filter(item => item.status === 'Pending').length;

  const approvedCount =
    reviews.filter(item => item.status === 'Approved').length;

  const changesCount =
    reviews.filter(item => item.status === 'Needs Changes').length;

  return (
    <div className="dashboard-layout">
      <Navbar />

      <div className="dashboard-body">
        <Sidebar role={role} />

        <main className="dashboard-content">

          <div className="page-header">
            <div>
              <h1>Review & Approval</h1>
              <p>
                Review submitted content against brand guidelines
                and AI findings before making approval decisions.
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="review-summary">
            <div className="review-summary-card">
              <h3>Total Submissions</h3>
              <h2>{reviews.length}</h2>
            </div>

            <div className="review-summary-card">
              <h3>Pending</h3>
              <h2>{pendingCount}</h2>
            </div>

            <div className="review-summary-card">
              <h3>Approved</h3>
              <h2>{approvedCount}</h2>
            </div>

            <div className="review-summary-card">
              <h3>Needs Changes</h3>
              <h2>{changesCount}</h2>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="review-filters">
            <input
              type="text"
              placeholder="Search by content title or creator..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Needs Changes">Needs Changes</option>
            </select>
          </div>

          {/* Submission Table */}
          <div className="data-table-container">
            <h2>Submission Reviews</h2>

            {loading && <p>Loading review records...</p>}

            {error && (
              <p className="error-message">{error}</p>
            )}

            {!loading && !error && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Content Title</th>
                    <th>Creator</th>
                    <th>Submitted Date</th>
                    <th>AI Analysis</th>
                    <th>Status</th>
                    <th>Reviewed Date</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredReviews.map(item => (
                    <Fragment key={item.id}>
                      <tr>
                        <td>{item.title}</td>
                        <td>{item.creator}</td>
                        <td>{formatDate(item.date)}</td>
                        <td>{item.aiStatus}</td>

                        <td>
                          <span
                            className={`status-badge ${
                              item.status === 'Approved'
                                ? 'active'
                                : item.status === 'Needs Changes'
                                  ? 'inactive'
                                  : 'pending'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>

                        <td>{formatDate(item.reviewedDate)}</td>

                        <td>
                          <div className="review-actions">

                            <button
                              type="button"
                              className="view-findings-btn"
                              onClick={() => handleViewContent(item)}
                            >
                              {detailLoadingId === item.id
                                ? 'Loading...'
                                : selectedSubmissionId === item.id
                                  ? 'Hide Content'
                                  : 'View Content'}
                            </button>

                            {isReviewer && (
                              <>
                                <button
                                  type="button"
                                  className="approve-btn"
                                  disabled={
                                    item.status !== 'Pending' ||
                                    savingId === item.id ||
                                    !viewedIds.includes(item.id)
                                  }
                                  onClick={() =>
                                    handleReview(item, 'Approved')
                                  }
                                >
                                  {savingId === item.id
                                    ? 'Saving...'
                                    : 'Approve'}
                                </button>

                                <button
                                  type="button"
                                  className="request-changes-btn"
                                  disabled={
                                    item.status !== 'Pending' ||
                                    savingId === item.id ||
                                    !viewedIds.includes(item.id)
                                  }
                                  onClick={() =>
                                    handleReview(item, 'Needs Changes')
                                  }
                                >
                                  Request Changes
                                </button>
                              </>
                            )}

                          </div>

                          {isReviewer && (
                            <textarea
                              className="review-comment"
                              placeholder="Enter review comments..."
                              disabled={
                                item.status !== 'Pending' ||
                                !viewedIds.includes(item.id)
                              }
                              value={comments[item.id] || ''}
                              onChange={e =>
                                setComments(prev => ({
                                  ...prev,
                                  [item.id]: e.target.value
                                }))
                              }
                            />
                          )}

                          {item.reviewComment && (
                            <p className="review-comment-preview">
                              <strong>Previous Review:</strong>{' '}
                              {item.reviewComment}
                            </p>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Submission Content */}
                      {selectedSubmissionId === item.id && (
                        <tr>
                          <td colSpan="7">
                            <div className="review-content-panel">

                              <h2>Submitted Content</h2>

                              {detailLoadingId === item.id && (
                                <p>Loading submitted content...</p>
                              )}

                              {detailError && (
                                <p className="error-message">
                                  {detailError}
                                </p>
                              )}

                              {submissionDetails[item.id] && (() => {
                                const {
                                  submission,
                                  findings
                                } = submissionDetails[item.id];

                                const {
                                  description,
                                  content
                                } = getContentDetails(submission);

                                return (
                                  <>
                                    <div className="review-submission-info">
                                      <p>
                                        <strong>Title:</strong>{' '}
                                        {submission.title || item.title}
                                      </p>

                                      <p>
                                        <strong>Category:</strong>{' '}
                                        {submission.category || '—'}
                                      </p>

                                      <p>
                                        <strong>Creator:</strong>{' '}
                                        {item.creator}
                                      </p>

                                      <p>
                                        <strong>Submitted:</strong>{' '}
                                        {formatDate(item.date)}
                                      </p>
                                    </div>

                                    {description && (
                                      <div className="review-content-section">
                                        <h3>Description</h3>
                                        <p>{description}</p>
                                      </div>
                                    )}

                                    <div className="review-content-section">
                                      <h3>Actual Submitted Content</h3>
                                      <div className="submitted-content">
                                        {content}
                                      </div>
                                    </div>

                                    <div className="review-content-section">
                                      <h3>AI Findings</h3>

                                      {findings.length === 0 ? (
                                        <p>
                                          No AI findings available for this submission.
                                        </p>
                                      ) : (
                                        findings.map((finding, index) => (
                                          <div
                                            className="review-ai-finding"
                                            key={finding._id || index}
                                          >
                                            <p>
                                              <strong>Issue:</strong>{' '}
                                              {finding.issue ||
                                                finding.title ||
                                                finding.description ||
                                                '—'}
                                            </p>

                                            <p>
                                              <strong>Severity:</strong>{' '}
                                              {finding.severity || '—'}
                                            </p>

                                            {finding.explanation && (
                                              <p>
                                                <strong>Reason:</strong>{' '}
                                                {finding.explanation}
                                              </p>
                                            )}

                                            {finding.suggestedCorrection && (
                                              <p>
                                                <strong>Suggested Correction:</strong>{' '}
                                                {finding.suggestedCorrection}
                                              </p>
                                            )}
                                          </div>
                                        ))
                                      )}
                                    </div>

                                    <div className="review-guideline-note">
                                      <strong>Reviewer reminder:</strong>
                                      {' '}Compare the submitted content and AI
                                      findings with the Admin's brand guidelines.
                                      Open the Guidelines page from the sidebar
                                      before making your decision.
                                      <br />

                                      <button
                                        type="button"
                                        className="view-findings-btn"
                                        onClick={() =>
                                          navigate('/guidelines')
                                        }
                                      >
                                        View Brand Guidelines
                                      </button>
                                    </div>
                                  </>
                                );
                              })()}

                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}

                  {filteredReviews.length === 0 && (
                    <tr>
                      <td colSpan="7">
                        No submissions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

        </main>
      </div>
    </div>
  );
}
