import { useState, useEffect } from 'react'

const AddUserForm = ({ onSave, editingUser, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'salesman',
    phone: '',
    address: '',
  })

  // Update form when editingUser changes
  useEffect(() => {
    if (editingUser) {
      setFormData({
        name: editingUser.name || '',
        email: editingUser.email || '',
        password: '', // Don't show password when editing
        role: editingUser.role || 'salesman',
        phone: editingUser.phone || '',
        address: editingUser.address || '',
      })
    } else {
      // Reset form when not editing
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'salesman',
        phone: '',
        address: '',
      })
    }
  }, [editingUser])

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Validate required fields
    if (!formData.name || !formData.email) {
      alert('Please fill in all required fields')
      return
    }

    // Prepare data to send
    const userData = {
      name: formData.name,
      email: formData.email,
      role: formData.role,
    }

    // When editing, include phone and address if they exist
    if (editingUser) {
      if (formData.phone) userData.phone = formData.phone
      if (formData.address) userData.address = formData.address
    }
    // When creating new user, don't send password, phone, or address
    // Salesman will set these on first login

    onSave(userData)
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-full">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">
        {editingUser ? 'Edit Salesman' : 'Add Salesman'}
      </h2>
      <p className="text-gray-600 mb-6">
        {editingUser ? 'Update salesman information' : 'Welcome back! Add a new salesman to the system'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name Field */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{top: '2.5rem'}}>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <input
            type="text"
            name="name"
            placeholder="Enter name"
            value={formData.name}
            onChange={handleChange}
            className="w-full pl-10 pr-4 py-3 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] transition-all duration-300 bg-white focus:bg-white shadow-sm focus:shadow-md"
            required
          />
        </div>

        {/* Email Field */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{top: '2.5rem'}}>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <input
            type="email"
            name="email"
            placeholder="Enter email"
            value={formData.email}
            onChange={handleChange}
            className="w-full pl-10 pr-4 py-3 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] transition-all duration-300 bg-white focus:bg-white shadow-sm focus:shadow-md"
            required
            disabled={editingUser && loading}
          />
        </div>

        {/* Role Field - Hidden, always salesman */}
        <input
          type="hidden"
          name="role"
          value="salesman"
        />

        {/* Phone and Address Fields - Only show when editing */}
        {editingUser && (
          <>
            {/* Phone Field - Optional */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone (Optional)</label>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{top: '2.5rem'}}>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <input
                type="tel"
                name="phone"
                placeholder="Enter phone number"
                value={formData.phone}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-3 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] transition-all duration-300 bg-white focus:bg-white shadow-sm focus:shadow-md"
                disabled={loading}
              />
            </div>

            {/* Address Field - Optional */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">Address (Optional)</label>
              <textarea
                name="address"
                placeholder="Enter address"
                value={formData.address}
                onChange={handleChange}
                rows="3"
                className="w-full pl-4 pr-4 py-3 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#e9931c] transition-all duration-300 bg-white focus:bg-white shadow-sm focus:shadow-md resize-none"
                disabled={loading}
              />
            </div>
          </>
        )}

        {/* Info message for new users */}
        {!editingUser && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> The salesman will receive an email to set their password and complete their profile (phone, address) on first login.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {editingUser && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 text-gray-700 bg-gray-100 text-base font-semibold py-3 rounded-lg shadow hover:shadow-md transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              disabled={loading}
              title="Cancel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Cancel</span>
            </button>
          )}
          <button
            type="submit"
            className={`flex-1 text-white text-base font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{backgroundColor: '#e9931c'}}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#d8820a'
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#e9931c'
              }
            }}
            disabled={loading}
            title={editingUser ? 'Update User' : 'Create User'}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                <span>Saving...</span>
              </>
            ) : editingUser ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Update</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Create</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddUserForm

