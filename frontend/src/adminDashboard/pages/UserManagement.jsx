import { useState, useEffect } from 'react'
import UserList from '../components/UserList'
import AddUserForm from '../components/AddUserForm'
import { getUsers, createUser, updateUser, deleteUser } from '../../services/adminservices/userService'
import Swal from 'sweetalert2'

const UserManagement = () => {
  const [users, setUsers] = useState([])
  const [editingUser, setEditingUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showFormOverlay, setShowFormOverlay] = useState(false)

  // Load users from backend on mount
  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const result = await getUsers('salesman') // Only fetch salesmen
      if (result.success && result.data) {
        // Filter to only show salesmen (double check)
        const salesmen = result.data.filter(user => user.role === 'salesman')
        setUsers(salesmen)
      } else {
        console.error('Failed to load users:', result.message)
        setUsers([])
      }
    } catch (error) {
      console.error('Error loading users:', error)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (userData) => {
    setLoading(true)
    try {
      let result
      if (editingUser) {
        // Update existing user
        result = await updateUser(editingUser._id || editingUser.id, userData)
      } else {
        // Create new user
        result = await createUser(userData)
      }

      if (result.success) {
        const setupLink = result.data?.setupLink
        if (!editingUser && setupLink) {
          await Swal.fire({
            icon: 'success',
            title: 'Salesman created!',
            html: `
              <p class="text-left mb-3">Send this link to the salesman to set their password:</p>
              <div class="bg-gray-100 p-3 rounded text-left text-sm break-all select-all font-mono">${setupLink}</div>
              <p class="text-left text-xs text-gray-500 mt-2">Link expires in 24 hours. You can also generate a new link from User List → "Generate Password Setup Link".</p>
            `,
            confirmButtonColor: '#e9931c',
            width: '520px',
          })
          if (navigator.clipboard?.writeText) {
            try {
              await navigator.clipboard.writeText(setupLink)
              Swal.fire({ icon: 'info', title: 'Copied!', text: 'Link copied to clipboard. Paste and send to the salesman.', confirmButtonColor: '#e9931c', timer: 2000, timerProgressBar: true })
            } catch (_) { }
          }
        } else {
          await Swal.fire({
            icon: 'success',
            title: 'Success',
            text: editingUser ? 'Salesman updated successfully!' : 'Salesman created successfully!',
            confirmButtonColor: '#e9931c',
          })
        }
        setEditingUser(null)
        loadUsers() // Reload users from backend
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: result.message || 'Failed to save user',
          confirmButtonColor: '#e9931c',
        })
      }
    } catch (error) {
      console.error('Error saving user:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error saving user. Please try again.',
        confirmButtonColor: '#e9931c',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (user) => {
    setEditingUser(user)
    setShowFormOverlay(true)
  }

  const handleDelete = async (userId) => {
    const confirmResult = await Swal.fire({
      icon: 'warning',
      title: 'Delete Salesman?',
      text: 'Are you sure you want to delete this user? This action cannot be undone.',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
    })
    if (!confirmResult.isConfirmed) return

    setLoading(true)
    try {
      const result = await deleteUser(userId)
      if (result.success) {
        await Swal.fire({
          icon: 'success',
          title: 'Deleted',
          text: 'Salesman deleted successfully!',
          confirmButtonColor: '#e9931c',
        })
        if (editingUser && (editingUser._id === userId || editingUser.id === userId)) {
          setEditingUser(null)
        }
        loadUsers() // Reload users from backend
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: result.message || 'Failed to delete user',
          confirmButtonColor: '#e9931c',
        })
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error deleting user. Please try again.',
        confirmButtonColor: '#e9931c',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingUser(null)
    setShowFormOverlay(false)
  }

  return (
    <div className="flex gap-3 sm:gap-4 p-3 sm:p-4 h-full min-h-0">
      {/* Left Panel - Salesman List (exactly 50% on desktop) */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col lg:flex-[0_0_calc(50%-0.5rem)] lg:max-w-[calc(50%-0.5rem)]">
        <UserList
          users={users}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onAddClick={() => {
            setEditingUser(null)
            setShowFormOverlay(true)
          }}
          loading={loading}
        />
      </div>

      {/* Right Panel - Add Salesman Form (exactly 50% on desktop) */}
      <div className="max-md:hidden flex flex-1 min-w-0 min-h-0 lg:flex-[0_0_calc(50%-0.5rem)] lg:max-w-[calc(50%-0.5rem)]">
        <AddUserForm
          onSave={handleSave}
          editingUser={editingUser}
          onCancel={handleCancelEdit}
          loading={loading}
        />
      </div>

      {/* Mobile: full-screen form overlay */}
      {showFormOverlay && (
        <div
          className="fixed inset-0 z-50 md:hidden bg-white flex flex-col overflow-hidden"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            minHeight: '100dvh',
          }}
        >
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
            <h2 className="text-lg font-bold text-gray-800">
              {editingUser ? 'Edit Salesman' : 'Add Salesman'}
            </h2>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="p-4 pb-8">
              <AddUserForm
                onSave={handleSave}
                editingUser={editingUser}
                onCancel={handleCancelEdit}
                loading={loading}
              />
            </div>
          </div>
        </div>
      )}
      <div className="h-20 md:h-28 lg:hidden"></div>
    </div>
  )
}

export default UserManagement

