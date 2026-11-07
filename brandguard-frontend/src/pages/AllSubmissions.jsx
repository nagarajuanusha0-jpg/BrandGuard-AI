
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import { apiRequest, getSavedUser } from '../services/api'

export default function AllSubmissions() {
  const navigate = useNavigate()
  const user = getSavedUser()
  const role = user?.role || 'Admin'

  const [submissions, setSubmissions] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSubmissions = useCallback(async () => {
    try {
      const response = await apiRequest('/submissions')
      const items = response.submissions || response.data || []

      setSubmissions(Array.isArray(items) ? items : [])
      setError('')
    } catch (err) {
      setError(err.message || 'Unable to load submissions.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Fetch submission records from the backend.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSubmissions()
  }, [loadSubmissions])

  const filteredSubmissions = submissions.filter(item => {
    const creatorName =
      item.createdBy?.name || item.creator?.name || 'Unknown'

    const matchesSearch =
      (item.title || '').toLowerCase().includes(search.toLowerCase()) ||
      creatorName.toLowerCase().includes(search.toLowerCase())

    const displayStatus =
      ['Submitted', 'Analysis Complete', 'Pending Review', 'Resubmitted']
        .includes(item.status)
        ? 'Pending'
        : item.status

    const matchesStatus =
      statusFilter === 'All' || displayStatus === statusFilter

    return matchesSearch && matchesStatus
  })

  const formatDate = date => {
    if (!date) return '—'

    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const getStatusClass = status => {
    if (status === 'Approved') return 'active'
    if (status === 'Pending') return 'pending'
    return 'inactive'
  }

  return (
    <div className="dashboard-layout">
      <Navbar />

      <div className="dashboard-body">
        <Sidebar role={role} />

        <main className="dashboard-content">
          <div className="page-header">
            <div>
              <h1>All Submissions</h1>
              <p>View and monitor all submitted content.</p>
            </div>
          </div>

          <div className="submission-filters">
            <input
              type="text"
              placeholder="Search by content or creator..."
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

          <div className="data-table-container">
            <h2>Submission Records</h2>

            {loading && <p>Loading submissions...</p>}

            {error && (
              <p className="error-message">{error}</p>
            )}

            {!loading && !error && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Content Name</th>
                    <th>Submitted By</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSubmissions.map(item => {
                    const creatorName =
                      item.createdBy?.name ||
                      item.creator?.name ||
                      'Unknown'

                    const displayStatus =
                      ['Submitted', 'Analysis Complete', 'Pending Review', 'Resubmitted']
                        .includes(item.status)
                        ? 'Pending'
                        : item.status

                    return (
                      <tr key={item._id}>
                        <td>{item.title}</td>
                        <td>{creatorName}</td>
                        <td>{formatDate(item.submittedAt || item.createdAt)}</td>
                        <td>
                          <span
                            className={`status-badge ${getStatusClass(displayStatus)}`}
                          >
                            {displayStatus}
                          </span>
                        </td>
                        <td>
                          <button
                            className="edit-btn"
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
                    )
                  })}

                  {filteredSubmissions.length === 0 && (
                    <tr>
                      <td colSpan="5">No submissions found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
