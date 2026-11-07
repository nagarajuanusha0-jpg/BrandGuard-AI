
import { useState } from 'react'

export default function UserTable({
  users = [],
  onEdit,
  onToggleStatus
}) {
  const [viewUser, setViewUser] = useState(null)

  return (
    <div className="data-table-container">
      <h2>Registered Users</h2>

      <table className="data-table">
        <thead>
          <tr>
            <th>User Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {users.map((user) => (
            <tr key={user._id || user.id || user.email}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.role}</td>

              <td>
                <span
                  className={`status-badge ${
                    user.status === 'Active' ? 'active' : 'inactive'
                  }`}
                >
                  {user.status || 'Active'}
                </span>
              </td>

              <td>
                <div className="user-actions">
                  <button
                    type="button"
                    className="view-btn"
                    onClick={() => setViewUser(user)}
                  >
                    View
                  </button>

                  <button
                    type="button"
                    className="edit-btn"
                    onClick={() => onEdit(user)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="status-btn"
                    onClick={() => onToggleStatus(user)}
                  >
                    {user.status === 'Active' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </td>
            </tr>
          ))}

          {users.length === 0 && (
            <tr>
              <td colSpan="5">No users registered yet.</td>
            </tr>
          )}
        </tbody>
      </table>

      {viewUser && (
        <div className="user-details-panel">
          <h3>User Details</h3>

          <p><strong>Name:</strong> {viewUser.name}</p>
          <p><strong>Email:</strong> {viewUser.email}</p>
          <p><strong>Role:</strong> {viewUser.role}</p>
          <p><strong>Status:</strong> {viewUser.status || 'Active'}</p>

          <button
            type="button"
            onClick={() => setViewUser(null)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}
