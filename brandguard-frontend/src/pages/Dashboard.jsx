import { useEffect, useState } from 'react';

import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import StatCard from '../components/StatCard';
import DataTable from '../components/DataTable';

import { apiRequest, getSavedUser } from '../services/api';

export default function Dashboard() {
  const [summary, setSummary] = useState({});
  const [activities, setActivities] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const user = getSavedUser();
  const role = user?.role || 'Creator';

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError('');

        const [summaryResponse, activityResponse, submissionResponse] =
  await Promise.all([
    apiRequest('/dashboard/summary'),
    apiRequest('/dashboard/activity'),
    apiRequest(
      role === 'Creator' ? '/submissions/mine' : '/submissions'
    )
  ]);
        const summaryData =
          summaryResponse.summary ||
          summaryResponse.data ||
          summaryResponse;

        const activityData =
          activityResponse.activity ||
          activityResponse.data ||
          [];

        const submissionData =
          submissionResponse.submissions ||
          submissionResponse.data ||
          [];

        setSummary(summaryData);
        setActivities(Array.isArray(activityData) ? activityData : []);
        setSubmissions(
          Array.isArray(submissionData) ? submissionData.slice(0, 5) : []
        );

      } catch (err) {
        setError(err.message || 'Unable to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [role]);

  return (
    <div className="dashboard-layout">
      <Navbar />

      <div className="dashboard-body">
        <Sidebar role={role} />

        <main className="dashboard-content">
          <h1>Dashboard</h1>
          <p>Welcome to your BrandGuard AI workspace.</p>

          {loading && <p>Loading dashboard data...</p>}

          {error && (
            <p className="error-message">
              {error}
            </p>
          )}

          <section className="stats-container">
            <StatCard
              title="Total Submissions"
              value={summary.totalSubmissions ?? 0}
              description="All submitted content"
            />

            <StatCard
              title="Pending Reviews"
              value={summary.pendingReviews ?? 0}
              description="Waiting for review"
            />

            <StatCard
              title="Approved Content"
              value={summary.approvedSubmissions ?? 0}
              description="Successfully approved"
            />

            <StatCard
              title="Needs Changes"
              value={summary.needsChanges ?? 0}
              description="Requires revision"
            />
          </section>

          {role === 'Admin' && (
            <section className="dashboard-extra-stats">
              <StatCard
                title="Total Users"
                value={summary.totalUsers ?? 0}
                description="Registered accounts"
              />

              <StatCard
                title="Total Guidelines"
                value={summary.totalGuidelines ?? 0}
                description="Available brand guidelines"
              />
            </section>
          )}

          <DataTable submissions={submissions} />

          <section className="recent-activity">
            <h2>Recent Activity</h2>

            {activities.length === 0 && !loading ? (
              <p>No recent activity available.</p>
            ) : (
              activities.map((item, index) => (
                <p key={item._id || item.id || index}>
                  {item.description ||
                    item.message ||
                    item.title ||
                    item.action ||
                    'Activity recorded'}
                </p>
              ))
            )}
          </section>
        </main>
      </div>
    </div>
  );
}