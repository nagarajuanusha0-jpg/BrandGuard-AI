
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import StatCard from '../components/StatCard'

export default function CreatorDashboard() {
  const navigate = useNavigate()

  const recentSubmissions = [
    {
      id: 1,
      title: 'Social Media Campaign',
      date: '05 Nov 2026',
      status: 'Pending'
    },
    {
      id: 2,
      title: 'Product Advertisement',
      date: '04 Nov 2026',
      status: 'Approved'
    },
    {
      id: 3,
      title: 'Brand Promotion',
      date: '03 Nov 2026',
      status: 'Needs Changes'
    }
  ]

  return (
    <div className="dashboard-layout">
      <Navbar />

      <div className="dashboard-body">
        <Sidebar role="Creator" />

        <main className="dashboard-content">

          <div className="page-header">
            <div>
              <h1>Creator Dashboard</h1>
              <p>Manage your content submissions and AI analysis.</p>
            </div>

            <button
              className="primary-btn"
              onClick={() => navigate('/submit')}
            >
              + Submit New Content
            </button>
          </div>

          {/* STATISTICS */}
          <div className="stats-grid">

            <StatCard
              title="Total Submissions"
              value="12"
            />

            <StatCard
              title="Pending Reviews"
              value="04"
            />

            <StatCard
              title="Approved Content"
              value="06"
            />

            <StatCard
              title="Needs Changes"
              value="02"
            />

          </div>

          {/* QUICK ACTIONS */}
          <section className="creator-quick-actions">
            <h2>Quick Actions</h2>

            <div className="creator-action-grid">

              <button onClick={() => navigate('/submit')}>
                <h3>Submit Content</h3>
                <p>Create and submit new brand content.</p>
              </button>

              <button onClick={() => navigate('/submissions')}>
                <h3>My Submissions</h3>
                <p>View and track your submitted content.</p>
              </button>

              <button onClick={() => navigate('/findings')}>
                <h3>AI Findings</h3>
                <p>View detected issues and suggestions.</p>
              </button>

              <button onClick={() => navigate('/guidelines')}>
                <h3>Brand Guidelines</h3>
                <p>Check approved brand rules and terminology.</p>
              </button>

            </div>
          </section>

          {/* RECENT SUBMISSIONS */}
          <section className="creator-recent-section">
            <div className="section-header">
              <h2>Recent Submissions</h2>

              <button onClick={() => navigate('/submissions')}>
                View All
              </button>
            </div>

            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Content Title</th>
                    <th>Submitted Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {recentSubmissions.map(item => (
                    <tr key={item.id}>
                      <td>{item.title}</td>
                      <td>{item.date}</td>

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

                      <td>
                        <button
                          className="view-btn"
                          onClick={() => navigate('/submissions')}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </main>
      </div>
    </div>
  )
}
