
import { useCallback, useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import UserTable from '../components/UserTable'
import { apiRequest, getSavedUser } from '../services/api'

export default function UserManagement() {
  const currentUser = getSavedUser()

  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
  if (!notice) return

  const timeoutId = setTimeout(() => {
    setNotice('')
  }, 3000)

  return () => clearTimeout(timeoutId)
}, [notice])
  const [editingUserId, setEditingUserId] = useState(null)
  const [pendingStatusUser, setPendingStatusUser] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('')

  const loadUsers = useCallback(async () => {
    try {
      const response = await apiRequest('/users')
      const items = response.data || response.users || []

      setUsers(
        Array.isArray(items)
          ? items.map(user => ({
              ...user,
              id: user._id || user.id,
              status: user.status || 'Active'
            }))
          : []
      )

      setError('')
    } catch (err) {
      setError(err.message || 'Unable to load users.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
  let isMounted = true

  async function fetchUsers() {
    try {
      const response = await apiRequest('/users')
      const items = response.data || response.users || []

      if (isMounted) {
        setUsers(
          Array.isArray(items)
            ? items.map(user => ({
                ...user,
                id: user._id || user.id,
                status: user.status || 'Active'
              }))
            : []
        )
        setError('')
      }
    } catch (err) {
      if (isMounted) {
        setError(err.message || 'Unable to load users.')
      }
    } finally {
      if (isMounted) {
        setLoading(false)
      }
    }
  }

  fetchUsers()

  return () => {
    isMounted = false
  }
}, [])
  const filteredUsers = users.filter(user => {
    const matchesSearch =
      (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.role || '').toLowerCase().includes(searchTerm.toLowerCase())

    const matchesRole =
      roleFilter === 'All' || user.role === roleFilter

    return matchesSearch && matchesRole
  })

  const activeUsers = users.filter(
    user => user.status === 'Active'
  ).length

  const inactiveUsers = users.filter(
    user => user.status === 'Inactive'
  ).length

  function handleCancel() {
    setShowForm(false)
    setEditingUserId(null)
    setName('')
    setEmail('')
    setPassword('')
    setRole('')
    setError('')
  }

  async function handleAddUser(e) {
    e.preventDefault()
    setError('')
    setNotice('')

    if (!name.trim() || !email.trim() || !role) {
      setError('Please fill in all required fields.')
      return
    }

    if (!editingUserId && password.length < 12) {
      setError('Password must contain at least 12 characters.')
      return
    }

    const emailExists = users.some(
      user =>
        user.email.toLowerCase() === email.trim().toLowerCase() &&
        user.id !== editingUserId
    )

    if (emailExists) {
      setError('This email address is already registered.')
      return
    }

    const userData = {
      name: name.trim(),
      email: email.trim(),
      role
    }

    try {
      setSaving(true)

      if (editingUserId) {
        await apiRequest(`/users/${editingUserId}`, {
          method: 'PATCH',
          body: JSON.stringify(userData)
        })

        setNotice('User updated successfully.')
      } else {
        await apiRequest('/users', {
          method: 'POST',
          body: JSON.stringify({
            ...userData,
            password
          })
        })

        setNotice('User created successfully.')
      }

      handleCancel()
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Unable to save user.')
    } finally {
      setSaving(false)
    }
  }

  function handleEditUser(user) {
    setEditingUserId(user.id)
    setName(user.name || '')
    setEmail(user.email || '')
    setPassword('')
    setRole(user.role || '')
    setError('')
    setNotice('')
    setShowForm(true)
  }

  function handleToggleStatus(user) {
    setPendingStatusUser(user)
    setError('')
    setNotice('')
  }

  async function confirmStatusChange() {
    if (!pendingStatusUser) return

    const user = pendingStatusUser
    const newStatus =
      user.status === 'Active' ? 'Inactive' : 'Active'

    try {
      setSaving(true)

      await apiRequest(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      })

      setPendingStatusUser(null)

      setNotice(
        newStatus === 'Inactive'
          ? `${user.name} has been deactivated.`
          : `${user.name} has been activated.`
      )

      await loadUsers()
    } catch (err) {
      setError(err.message || 'Unable to update user status.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dashboard-layout">
      <Navbar />

      <div className="dashboard-body">
        <Sidebar role={currentUser?.role || 'Admin'} />

        <main className="dashboard-content">

          <div className="page-header">
            <div>
              <h1>User Management</h1>
              <p>Manage users and their roles in BrandGuard AI.</p>
            </div>

            <button
              className="add-user-btn"
              onClick={() => {
                handleCancel()
                setNotice('')
                setShowForm(true)
              }}
            >
              + Add User
            </button>
          </div>

          <div className="stats-container user-stats">
            <div className="stat-card">
              <h3>Total Users</h3>
              <h2>{activeUsers}</h2>
              <p>Currently active employees</p>
            </div>

            <div className="stat-card">
              <h3>Active Users</h3>
              <h2>{activeUsers}</h2>
              <p>Currently working</p>
            </div>

            <div className="stat-card">
              <h3>Inactive Accounts</h3>
              <h2>{inactiveUsers}</h2>
              <p>Access deactivated</p>
            </div>
          </div>

          {notice && (
            <div className="success-message">
              {notice}
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {pendingStatusUser && (
            <div className="user-confirmation">
              <p>
                Are you sure you want to{' '}
                {pendingStatusUser.status === 'Active'
                  ? 'deactivate'
                  : 'activate'}{' '}
                <strong>{pendingStatusUser.name}</strong>?
              </p>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={confirmStatusChange}
                  disabled={saving}
                >
                  {saving ? 'Updating...' : 'Confirm'}
                </button>

                <button
                  type="button"
                  onClick={() => setPendingStatusUser(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {showForm && (
            <form className="user-form" onSubmit={handleAddUser}>
              <h2>
                {editingUserId ? 'Edit User' : 'Add New User'}
              </h2>

              <label>Full Name</label>
              <input
                type="text"
                placeholder="Enter full name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />

              <label>Email Address</label>
              <input
                type="email"
                placeholder="Enter email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />

              {!editingUserId && (
                <>
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="Enter password (minimum 12 characters)"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    minLength={12}
                    required
                  />
                </>
              )}

              <label>Assign Role</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                required
              >
                <option value="">Select Role</option>
                <option value="Admin">Admin</option>
                <option value="Manager">Manager</option>
                <option value="Creator">Creator</option>
                <option value="Reviewer">Reviewer</option>
              </select>

              <div className="form-actions">
                <button type="submit" disabled={saving}>
                  {saving
                    ? 'Saving...'
                    : editingUserId
                      ? 'Update User'
                      : 'Add User'}
                </button>

                <button type="button" onClick={handleCancel}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="search-container">
            <input
              type="text"
              placeholder="Search by name, email or role..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="role-filter">
            <label>Filter by Role:</label>

            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="All">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="Manager">Manager</option>
              <option value="Creator">Creator</option>
              <option value="Reviewer">Reviewer</option>
            </select>
          </div>

          {loading ? (
            <p>Loading users...</p>
          ) : (
            <UserTable
              users={filteredUsers}
              onEdit={handleEditUser}
              onToggleStatus={handleToggleStatus}
            />
          )}

        </main>
      </div>
    </div>
  )
}
