
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

import { apiRequest, getSavedUser } from '../services/api';

export default function MySubmissions() {
  const navigate = useNavigate();

  const user = getSavedUser();
  const role = user?.role || 'Creator';

  const [submissions, setSubmissions] = useState([]);
  const [reviewHistory, setReviewHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Load Creator's submissions and review feedback
  const loadSubmissions = useCallback(async () => {
    try {
      const response = await apiRequest('/submissions/mine');

      const items =
        response.submissions ||
        response.data ||
        [];

      setSubmissions(Array.isArray(items) ? items : []);
      setError('');

      // Load saved reviewer comments separately
      try {
        const reviewResponse = await apiRequest('/reviews');

        const reviews =
          reviewResponse.reviews ||
          reviewResponse.data ||
          [];

        setReviewHistory(Array.isArray(reviews) ? reviews : []);
      } catch (reviewError) {
        console.error(
          'Unable to load reviewer feedback:',
          reviewError
        );

        setReviewHistory([]);
      }

    } catch (err) {
      setError(err.message || 'Unable to load submissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSubmissions();
  }, [loadSubmissions]);

  // Display status
  const getDisplayStatus = status => {
    if (status === 'Approved') return 'Approved';
    if (status === 'Needs Changes') return 'Needs Changes';

    if (
      [
        'Submitted',
        'Analyzing',
        'Analysis Complete',
        'Resubmitted',
        'Pending Review'
      ].includes(status)
    ) {
      return 'Pending';
    }

    return status || 'Pending';
  };

  // AI analysis status
  const getAIStatus = status => {
    if (status === 'Analyzing') return 'Processing';

    if (
      [
        'Analysis Complete',
        'Pending Review',
        'Approved',
        'Needs Changes'
      ].includes(status)
    ) {
      return 'Completed';
    }

    return 'Not Started';
  };

  // Existing backend PATCH currently permits these statuses
  const canEdit = status => {
    return [
      'Draft',
      'Needs Changes',
      'Analysis Complete'
    ].includes(status);
  };

  // Get the review feedback for the current submission revision
  const getLatestReview = item => {
    const matchingReviews = reviewHistory.filter(review => {
      const reviewSubmissionId =
        review.submissionId?._id ||
        review.submissionId;

      const sameSubmission =
        String(reviewSubmissionId) === String(item._id);

      const sameRevision =
        item.currentRevision == null ||
        Number(review.revisionNumber) === Number(item.currentRevision);

      return sameSubmission && sameRevision;
    });

    // Backend returns reviews sorted by reviewedAt descending
    return matchingReviews[0] || null;
  };

  // Search and filter
  const filteredSubmissions = submissions.filter(item => {
    const type = item.category || '';

    const matchesSearch =
      (item.title || '')
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      type.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'All' ||
      getDisplayStatus(item.status) === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Date formatting
  const formatDate = date => {
    if (!date) return '—';

    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Open existing submission in edit mode
  const handleEdit = item => {
    navigate('/submit', {
      state: {
        submissionId: item._id
      }
    });
  };

  // Open delete confirmation
  const handleDeleteClick = item => {
    setDeleteTarget(item);
  };

  // Permanently delete submission
  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;

    try {
      setDeleting(true);
      setError('');

      await apiRequest(`/submissions/${deleteTarget._id}`, {
        method: 'DELETE'
      });

      setDeleteTarget(null);
      setNotification('Submission deleted successfully.');

      await loadSubmissions();

    } catch (err) {
      setError(err.message || 'Unable to delete submission.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <Navbar />

      <div className="dashboard-body">
        <Sidebar role={role} />

        <main className="dashboard-content">

          {/* Page Header */}
          <div className="page-header">
            <div>
              <h1>My Submissions</h1>
              <p>Track and manage your submitted content.</p>
            </div>

            <button
              className="primary-btn"
              onClick={() => navigate('/submit')}
            >
              + New Submission
            </button>
          </div>

          {/* In-app notification */}
          {notification && (
            <div className="submission-notification">
              <span>{notification}</span>

              <button
                type="button"
                onClick={() => setNotification('')}
                aria-label="Close notification"
              >
                ×
              </button>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="submission-error">
              {error}
            </p>
          )}

          {/* Summary Cards */}
          <div className="my-submission-summary">

            <div className="my-submission-card">
              <h3>Total Submissions</h3>
              <h2>{submissions.length}</h2>
            </div>

            <div className="my-submission-card">
              <h3>Pending</h3>
              <h2>
                {submissions.filter(
                  item => getDisplayStatus(item.status) === 'Pending'
                ).length}
              </h2>
            </div>

            <div className="my-submission-card">
              <h3>Approved</h3>
              <h2>
                {submissions.filter(
                  item => item.status === 'Approved'
                ).length}
              </h2>
            </div>

            <div className="my-submission-card">
              <h3>Needs Changes</h3>
              <h2>
                {submissions.filter(
                  item => item.status === 'Needs Changes'
                ).length}
              </h2>
            </div>

          </div>

          {/* Search and Filters */}
          <div className="my-submission-filters">

            <input
              type="text"
              placeholder="Search submissions..."
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

          {/* Submission History */}
          <div className="data-table-container">

            <h2>Submission History</h2>

            {loading ? (
              <p>Loading your submissions...</p>
            ) : (
              <table className="data-table">

                <thead>
                  <tr>
                    <th>Content Title</th>
                    <th>Content Type</th>
                    <th>Submitted Date</th>
                    <th>AI Analysis</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>

                  {filteredSubmissions.map(item => {
                    const displayStatus = getDisplayStatus(item.status);
                    const latestReview = getLatestReview(item);

                    const reviewerFeedback =
                      item.status === 'Needs Changes' &&
                      latestReview?.decision === 'Needs Changes'
                        ? latestReview
                        : null;

                    return (
                      <tr key={item._id}>

                        <td>{item.title}</td>

                        <td>{item.category}</td>

                        <td>
                          {formatDate(
                            item.submittedAt || item.createdAt
                          )}
                        </td>

                        <td>{getAIStatus(item.status)}</td>

                        <td>
                          <span
                            className={`status-badge ${
                              displayStatus === 'Approved'
                                ? 'active'
                                : displayStatus === 'Needs Changes'
                                  ? 'inactive'
                                  : 'pending'
                            }`}
                          >
                            {displayStatus}
                          </span>
                        </td>

                        <td>
                          <div className="submission-action-buttons">

                            <button
                              type="button"
                              className="view-btn"
                              onClick={() =>
                                navigate('/findings', {
                                  state: {
                                    submissionId: item._id
                                  }
                                })
                              }
                            >
                              View Findings
                            </button>

                            {canEdit(item.status) && (
                              <button
                                type="button"
                                className="edit-submission-btn"
                                onClick={() => handleEdit(item)}
                              >
                                {item.status === 'Needs Changes'
                                  ? 'Edit & Resubmit'
                                  : 'Edit'}
                              </button>
                            )}

                            <button
                              type="button"
                              className="delete-submission-btn"
                              onClick={() => handleDeleteClick(item)}
                            >
                              Delete
                            </button>

                          </div>

                          {/* Reviewer Feedback */}
                          {reviewerFeedback && (
                            <div
                              style={{
                                marginTop: '12px',
                                padding: '12px',
                                background: '#fff7ed',
                                border: '1px solid #fed7aa',
                                borderRadius: '8px',
                                minWidth: '220px'
                              }}
                            >
                              <h4
                                style={{
                                  margin: '0 0 8px',
                                  color: '#9a3412'
                                }}
                              >
                                <span style={{ marginRight: '6px' }}>
                                  ⚠
                                </span>
                                Reviewer Feedback
                              </h4>

                              <p
                                style={{
                                  margin: '0 0 8px',
                                  color: '#444',
                                  whiteSpace: 'pre-wrap',
                                  overflowWrap: 'anywhere'
                                }}
                              >
                                {reviewerFeedback.comment}
                              </p>

                              <p
                                style={{
                                  margin: 0,
                                  fontSize: '12px',
                                  color: '#777'
                                }}
                              >
                                Decision: Request Changes
                              </p>

                              <p
                                style={{
                                  margin: '4px 0 0',
                                  fontSize: '12px',
                                  color: '#777'
                                }}
                              >
                                Reviewed on:{' '}
                                {formatDate(reviewerFeedback.reviewedAt)}
                              </p>
                            </div>
                          )}

                        </td>

                      </tr>
                    );
                  })}

                  {filteredSubmissions.length === 0 && (
                    <tr>
                      <td colSpan="6">
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

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="submission-modal-overlay">

          <div
            className="submission-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
          >
            <h2 id="delete-confirm-title">
              Delete Submission?
            </h2>

            <p>
              Are you sure you want to delete
              {' '}
              <strong>{deleteTarget.title}</strong>?
            </p>

            <p className="delete-warning">
              This will permanently delete the submission,
              its findings, revisions and review history.
            </p>

            <div className="submission-modal-actions">

              <button
                type="button"
                className="cancel-delete-btn"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="confirm-delete-btn"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>

            </div>
          </div>

        </div>
      )}

    </div>
  );
}
