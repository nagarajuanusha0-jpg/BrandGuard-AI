
import { useCallback, useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import { apiRequest, getSavedUser, getToken } from '../services/api'

const API_BASE_URL = 'http://localhost:5000/api'

export default function Guidelines() {
  const user = getSavedUser()
  const role = user?.role || 'Creator'
  const isAdmin = role === 'Admin'

  const [guidelines, setGuidelines] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [existingAttachment, setExistingAttachment] = useState(null)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [search, setSearch] = useState('')

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Brand Guidelines')
  const [description, setDescription] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [openingFileId, setOpeningFileId] = useState(null)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!notice) return

    const timeoutId = setTimeout(() => {
      setNotice('')
    }, 3000)

    return () => clearTimeout(timeoutId)
  }, [notice])

  const loadGuidelines = useCallback(async () => {
    try {
      const response = await apiRequest('/guidelines')
      const items = response.data || response.guidelines || []

      setGuidelines(Array.isArray(items) ? items : [])
      setError('')
    } catch (err) {
      setError(err.message || 'Unable to load guidelines.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
  let isMounted = true

  async function fetchGuidelines() {
    try {
      const response = await apiRequest('/guidelines')
      const items = response.data || response.guidelines || []

      if (isMounted) {
        setGuidelines(Array.isArray(items) ? items : [])
        setError('')
      }
    } catch (err) {
      if (isMounted) {
        setError(err.message || 'Unable to load guidelines.')
      }
    } finally {
      if (isMounted) {
        setLoading(false)
      }
    }
  }

  fetchGuidelines()

  return () => {
    isMounted = false
  }
}, [])

  const filteredGuidelines = guidelines.filter(item =>
    item.title?.toLowerCase().includes(search.toLowerCase()) ||
    item.category?.toLowerCase().includes(search.toLowerCase())
  )

  function handleCancel() {
    setShowForm(false)
    setEditingId(null)
    setTitle('')
    setCategory('Brand Guidelines')
    setDescription('')
    setSelectedFile(null)
    setExistingAttachment(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    try {
      setSaving(true)
      setError('')
      setNotice('')

      const formData = new FormData()

      formData.append('title', title.trim())
      formData.append('category', category)
      formData.append('description', description.trim())

      if (selectedFile) {
        formData.append('file', selectedFile)
      }

      const endpoint = editingId
        ? `/guidelines/${editingId}`
        : '/guidelines'

      const response = await apiRequest(endpoint, {
        method: editingId ? 'PATCH' : 'POST',
        body: formData
      })

      handleCancel()

      setNotice(
        response.message ||
        (editingId
          ? 'Guideline updated successfully.'
          : 'Guideline created successfully.')
      )

      await loadGuidelines()
    } catch (err) {
      setError(err.message || 'Unable to save guideline.')
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(item) {
    setEditingId(item._id || item.id)
    setTitle(item.title || '')
    setCategory(item.category || 'Brand Guidelines')
    setDescription(item.description || '')
    setExistingAttachment(item.attachment || null)
    setSelectedFile(null)
    setError('')
    setNotice('')
    setShowForm(true)
  }

  async function handleViewDocument(fileId) {
    if (!fileId) {
      setError('Document is not available.')
      return
    }

    // Open a blank tab immediately to avoid popup blocking.
    const previewWindow = window.open('', '_blank')

    if (!previewWindow) {
      setError('Please allow popups to view the document.')
      return
    }

    try {
      setOpeningFileId(fileId)
      setError('')

      const response = await fetch(
        `${API_BASE_URL}/files/${encodeURIComponent(fileId)}`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`
          }
        }
      )

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Unable to open document.')
      }

      const blob = await response.blob()
      const fileUrl = URL.createObjectURL(blob)

      previewWindow.location.href = fileUrl

      // Keep the object URL available while the document opens.
      setTimeout(() => URL.revokeObjectURL(fileUrl), 60000)
    } catch (err) {
      previewWindow.close()
      setError(err.message || 'Unable to open document.')
    } finally {
      setOpeningFileId(null)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Archive this guideline?')) return

    try {
      setError('')
      setNotice('')

      const response = await apiRequest(`/guidelines/${id}`, {
        method: 'DELETE'
      })

      setNotice(response.message || 'Guideline archived successfully.')
      await loadGuidelines()
    } catch (err) {
      setError(err.message || 'Unable to delete guideline.')
    }
  }

  return (
    <div className="dashboard-layout">
      <Navbar />

      <div className="dashboard-body">
        <Sidebar role={role} />

        <main className="dashboard-content">

          <div className="page-header">
            <div>
              <h1>Guidelines Management</h1>
              <p>Manage brand guidelines, facts and terminology.</p>
            </div>

            {isAdmin && (
              <button
                className="add-user-btn"
                onClick={() => {
                  handleCancel()
                  setError('')
                  setNotice('')
                  setShowForm(true)
                }}
              >
                + Add Guideline
              </button>
            )}
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

          {showForm && isAdmin && (
            <form className="guideline-form" onSubmit={handleSubmit}>
              <h2>{editingId ? 'Edit Guideline' : 'Add New Guideline'}</h2>

              <label>Guideline Title</label>
              <input
                type="text"
                placeholder="Enter guideline title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />

              <label>Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                <option>Brand Guidelines</option>
                <option>Brand Facts</option>
                <option>Terminology</option>
              </select>

              <label>Description</label>
              <textarea
                placeholder="Enter guideline details"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows="4"
                required
              />

              <label>Upload Guideline Document</label>

              {existingAttachment?.originalName && (
                <div className="existing-file">
                  <p>
                    Existing document: <strong>{existingAttachment.originalName}</strong>
                  </p>

                  <button
                    type="button"
                    className="view-btn"
                    onClick={() =>
                      handleViewDocument(existingAttachment.fileId)
                    }
                    disabled={openingFileId === existingAttachment.fileId}
                  >
                    {openingFileId === existingAttachment.fileId
                      ? 'Opening...'
                      : 'View Existing Document'}
                  </button>
                </div>
              )}

              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx"
                onChange={e =>
                  setSelectedFile(e.target.files[0] || null)
                }
              />

              {selectedFile && (
                <p className="selected-file">
                  Replacement document: {selectedFile.name}
                </p>
              )}

              {editingId && existingAttachment && !selectedFile && (
                <p className="file-note">
                  Leave the upload field empty to keep the existing document.
                </p>
              )}

              <div className="form-actions">
                <button type="submit" disabled={saving}>
                  {saving
                    ? 'Saving...'
                    : editingId
                      ? 'Update Guideline'
                      : 'Save Guideline'}
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
              placeholder="Search guidelines..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <p>Loading guidelines...</p>
          ) : (
            <div className="guidelines-grid">

              {filteredGuidelines.map(item => {
                const id = item._id || item.id

                return (
                  <div className="guideline-card" key={id}>
                    <span className="guideline-category">
                      {item.category}
                    </span>

                    <h3>{item.title}</h3>
                    <p>{item.description}</p>

                    {item.attachment?.originalName && (
                      <div className="existing-file">
                        <p className="selected-file">
                          Document: {item.attachment.originalName}
                        </p>

                        <button
                          type="button"
                          className="view-btn"
                          onClick={() =>
                            handleViewDocument(item.attachment.fileId)
                          }
                          disabled={
                            openingFileId === item.attachment.fileId
                          }
                        >
                          {openingFileId === item.attachment.fileId
                            ? 'Opening...'
                            : 'View Document'}
                        </button>
                      </div>
                    )}

                    {isAdmin && (
                      <div className="user-actions">
                        <button
                          type="button"
                          className="edit-btn"
                          onClick={() => handleEdit(item)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="delete-btn"
                          onClick={() => handleDelete(id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}

              {filteredGuidelines.length === 0 && (
                <p>No guidelines found.</p>
              )}

            </div>
          )}

        </main>
      </div>
    </div>
  )
}
