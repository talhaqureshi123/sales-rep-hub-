import { useState, useEffect } from 'react'
import UserList from '../components/UserList'
import AddUserForm from '../components/AddUserForm'
import { getUsers, createUser, updateUser, deleteUser } from '../../services/adminservices/userService'
import Swal from 'sweetalert2'

const UserManagement = () => {
  const [users, setUsers] = useState([])
  const [editingUser, setEditingUser] = useState(null)
  const [loading, setLoading] = useState(false)

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
            } catch (_) {}
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
  }

  return (
    <div className="flex gap-2 p-3 h-full">
      {/* Left Panel - User List */}
      <div className="flex-1">
        <UserList users={users} onEdit={handleEdit} onDelete={handleDelete} />
      </div>

      {/* Right Panel - Add User Form */}
      <div className="flex">
        <AddUserForm
          onSave={handleSave}
          editingUser={editingUser}
          onCancel={handleCancelEdit}
        />
      </div>
    </div>
  )
}

export default UserManagement

