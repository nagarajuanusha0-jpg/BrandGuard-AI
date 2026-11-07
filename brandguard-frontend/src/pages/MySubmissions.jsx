
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load creator submissions from backend
  const loadSubmissions = useCallback(async () => {
    try {
      const response = await apiRequest('/submissions/mine');

      const items =
        response.submissions ||
        response.data ||
        [];

      setSubmissions(Array.isArray(items) ? items : []);
      setError('');

    } catch (err) {
      setError(err.message || 'Unable to load submissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch submission history from the backend.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSubmissions();
  }, [loadSubmissions]);

  // Convert backend statuses into display labels
  const getDisplayStatus = (status) => {
    if (status === 'Approved') return 'Approved';
    if (status === 'Needs Changes') return 'Needs Changes';

    if (
      ['Submitted', 'Analyzing', 'Analysis Complete',
       'Resubmitted', 'Pending Review'].includes(status)
    ) {
      return 'Pending';
    }

    return status || 'Pending';
  };

  const getAIStatus = (status) => {
    if (status === 'Analyzing') return 'Processing';

    if (
      ['Analysis Complete', 'Pending Review',
       'Approved', 'Needs Changes'].includes(status)
    ) {
      return 'Completed';
    }

    return 'Not Started';
  };

  const filteredSubmissions = submissions.filter(item => {
    const type = item.category || '';

    const matchesSearch =
      (item.title || '').toLowerCase().includes(search.toLowerCase()) ||
      type.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'All' ||
      getDisplayStatus(item.status) === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const formatDate = (date) => {
    if (!date) return '—';

    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="dashboard-layout">
      <Navbar />

      <div className="dashboard-body">
        <Sidebar role={role} />

        <main className="dashboard-content">

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

          {error && (
            <p style={{ color: 'red', margin: '12px 0' }}>
              {error}
            </p>
          )}

          {/* SUMMARY CARDS */}

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

          {/* SEARCH AND FILTER */}

          <div className="my-submission-filters">

            <input
              type="text"
              placeholder="Search submissions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Needs Changes">Needs Changes</option>
            </select>

          </div>

          {/* SUBMISSIONS TABLE */}

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

                    return (
                      <tr key={item._id}>

                        <td>{item.title}</td>

                        <td>{item.category}</td>

                        <td>{formatDate(item.submittedAt || item.createdAt)}</td>

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
                          <button
                            type="button"
                            className="view-btn"
                            onClick={() =>
                              navigate('/findings', {
                                state: { submissionId: item._id }
                              })
                            }
                          >
                            View Findings
                          </button>
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
    </div>
  );
}
