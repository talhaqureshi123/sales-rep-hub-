import { useState, useEffect } from 'react'
import UserList from '../components/UserList'
import AddUserForm from '../components/AddUserForm'
import { getUsers, createUser, updateUser, deleteUser } from '../../services/adminservices/userService'

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
        alert(editingUser ? 'User updated successfully!' : 'User created successfully!')
        setEditingUser(null)
        loadUsers() // Reload users from backend
      } else {
        alert(result.message || 'Failed to save user')
      }
    } catch (error) {
      console.error('Error saving user:', error)
      alert('Error saving user')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (user) => {
    setEditingUser(user)
  }

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return
    }

    setLoading(true)
    try {
      const result = await deleteUser(userId)
      if (result.success) {
        alert('User deleted successfully!')
        if (editingUser && (editingUser._id === userId || editingUser.id === userId)) {
          setEditingUser(null)
        }
        loadUsers() // Reload users from backend
      } else {
        alert(result.message || 'Failed to delete user')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Error deleting user')
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

