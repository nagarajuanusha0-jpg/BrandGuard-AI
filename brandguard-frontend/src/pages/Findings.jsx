
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  apiRequest,
  getSavedUser
} from '../services/api';

import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

export default function Findings() {
  const location = useLocation();
  const navigate = useNavigate();

  const user = getSavedUser();
  const role = user?.role || '';

  const selectedSubmissionId = location.state?.submissionId;

  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [retryCount, setRetryCount] = useState(0);

  // Fetch AI findings
  useEffect(() => {
    let isMounted = true;

    const fetchFindings = async () => {
      try {
        const endpoint = selectedSubmissionId
          ? `/submissions/${selectedSubmissionId}/findings`
          : '/findings';

        const response = await apiRequest(endpoint);

        const data = response?.findings || response?.data || [];

        if (isMounted) {
          setFindings(Array.isArray(data) ? data : []);
          setError('');
        }
      } catch (err) {
        console.error('Error loading findings:', err);

        if (isMounted) {
          setError(err.message || 'Failed to load findings.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchFindings();

    return () => {
      isMounted = false;
    };
  }, [selectedSubmissionId, retryCount]);

  // Retry loading findings
  const handleRetry = () => {
    setLoading(true);
    setError('');
    setRetryCount((count) => count + 1);
  };

  // Filter findings by severity
  const filteredFindings = findings.filter((item) => {
    if (filter === 'All') return true;

    return (
      String(item.severity || '').toLowerCase() ===
      filter.toLowerCase()
    );
  });

  // Common page layout
  const renderLayout = (content) => (
    <div className="dashboard-layout">
      <Navbar />

      <div className="dashboard-body">
        <Sidebar role={role} />

        <main className="dashboard-content">
          {content}
        </main>
      </div>
    </div>
  );

  // Loading state
  if (loading) {
    return renderLayout(
      <div className="findings-page">
        <h2>AI Findings</h2>
        <p>Loading findings...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return renderLayout(
      <div className="findings-page">
        <div className="findings-header">
          <h2>AI Findings</h2>
          <p>Review AI-generated content analysis and suggestions.</p>
        </div>

        <p className="findings-error">{error}</p>

        <button onClick={handleRetry}>
          Try Again
        </button>
      </div>
    );
  }

  // Normal findings page
  return renderLayout(
    <div className="findings-page">

      <div className="findings-header">
        <h2>AI Findings</h2>
        <p>
          Review AI-generated content analysis and suggestions.
        </p>
      </div>

      {/* Findings Summary */}
      <div className="findings-summary">
        <div className="summary-card">
          <h3>{findings.length}</h3>
          <p>Total Findings</p>
        </div>
      </div>

      {/* Severity Filters */}
      <div className="findings-filters">
        {['All', 'Critical', 'High', 'Medium', 'Low'].map((item) => (
          <button
            key={item}
            className={filter === item ? 'active' : ''}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {/* Findings Cards */}
      <div className="findings-list">

        {filteredFindings.length === 0 ? (
          <p>No findings available.</p>
        ) : (
          filteredFindings.map((item) => {
            const submissionId =
              (typeof item.submissionId === 'object'
                ? item.submissionId?._id
                : item.submissionId) ||
              item.submission?._id ||
              selectedSubmissionId;

            return (
              <div className="finding-card" key={item._id}>

                <div className="finding-card-header">
                  <h3>
                    {item.title || item.issue || 'Content Finding'}
                  </h3>

                  <span
                    className={`severity ${String(
                      item.severity || 'Low'
                    ).toLowerCase()}`}
                  >
                    {item.severity || 'Not specified'}
                  </span>
                </div>

                <p>
                  <strong>Issue:</strong>{' '}
                  {item.issue ||
                    item.description ||
                    'No issue description available.'}
                </p>

                {item.source && (
                  <p>
                    <strong>Source:</strong> {item.source}
                  </p>
                )}

                {item.explanation && (
                  <p>
                    <strong>Reason:</strong> {item.explanation}
                  </p>
                )}

                {item.suggestedCorrection && (
                  <p>
                    <strong>Suggested Correction:</strong>{' '}
                    {item.suggestedCorrection}
                  </p>
                )}

                {/* Creator Action */}
                {role === 'Creator' && submissionId && (
                  <div className="findings-footer">
                    <button
                      className="edit-btn"
                      onClick={() =>
                        navigate('/submit', {
                          state: { submissionId }
                        })
                      }
                    >
                      Edit Content
                    </button>
                  </div>
                )}

              </div>
            );
          })
        )}

      </div>

      {/* Reviewer Action */}
      {role === 'Reviewer' && (
        <div className="findings-footer">
          <button
            className="review-btn"
            onClick={() => navigate('/review')}
          >
            Go to Review &amp; Approval
          </button>
        </div>
      )}

    </div>
  );
}
