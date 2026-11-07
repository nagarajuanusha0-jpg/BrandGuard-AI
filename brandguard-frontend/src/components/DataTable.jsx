import { useNavigate } from 'react-router-dom';

export default function DataTable({ submissions = [] }) {
  const navigate = useNavigate();

  const formatDate = (date) => {
    if (!date) return '—';

    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusClass = (status) => {
    return (status || 'Pending').toLowerCase().replace(/\s+/g, '-');
  };

  return (
    <div className="data-table-container">
      <h2>Recent Submissions</h2>

      {submissions.length === 0 ? (
        <p>No submissions available.</p>
      ) : (
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
            {submissions.map((item) => (
              <tr key={item._id || item.id}>
                <td>{item.title || 'Untitled'}</td>
                <td>
                  {item.createdBy?.name || item.createdBy?.email || 'Creator'}
                </td>
                <td>{formatDate(item.submittedAt || item.createdAt)}</td>
                <td>
                  <span className={`status-badge ${getStatusClass(item.status)}`}>
                    {item.status || 'Pending'}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="view-btn"
                    onClick={() =>
                      navigate('/findings', {
                        state: { submissionId: item._id || item.id }
                      })
                    }
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}