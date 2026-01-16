import { useState } from 'react'
import { generatePasswordLink } from '../../services/adminservices/userService'
import { FaEdit, FaTrash, FaLink } from 'react-icons/fa'

const UserList = ({ users, onEdit, onDelete, loading }) => {
  const [passwordLink, setPasswordLink] = useState(null)
  const [generatingLink, setGeneratingLink] = useState(null)
  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-full">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Salesman Management</h2>
      <p className="text-gray-600 mb-6">Salesman List</p>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 px-4 text-gray-700 font-semibold">Name / Email</th>
              <th className="text-left py-3 px-4 text-gray-700 font-semibold">Status</th>
              <th className="text-left py-3 px-4 text-gray-700 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="3" className="text-center py-8 text-gray-500">
                  No salesmen found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user._id || user.id} className="border-b border-gray-100 hover:bg-orange-50 transition-colors">
                  <td className="py-4 px-4">
                    <div className="font-medium text-gray-800 text-left">{user.name}</div>
                    <div className="text-sm text-gray-500 text-left">{user.email}</div>
                    <div className="text-xs text-gray-400 text-left mt-1">
                      Role: <span className="font-semibold capitalize">Salesman</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        user.status === 'Active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          setGeneratingLink(user._id || user.id)
                          try {
                            const result = await generatePasswordLink(user._id || user.id)
                            if (result.success && result.data) {
                              setPasswordLink({
                                user: user.name,
                                email: user.email,
                                link: result.data.setupUrl
                              })
                              
                              // Show success message
                              if (result.data.emailSent) {
                                alert(`✅ Password setup link generated and sent to ${user.email}!\n\n${user.name} will receive an email with the setup link.\n\nLink: ${result.data.setupUrl}`)
                              } else {
                                // Copy to clipboard if email not sent
                                navigator.clipboard.writeText(result.data.setupUrl)
                                alert(`⚠️ Password setup link generated but email not sent (email not configured).\n\nLink copied to clipboard. Send this link to ${user.name}:\n${result.data.setupUrl}`)
                              }
                            } else {
                              alert(result.message || 'Failed to generate password link')
                            }
                          } catch (error) {
                            console.error('Error generating link:', error)
                            alert('Error generating password link')
                          } finally {
                            setGeneratingLink(null)
                          }
                        }}
                        className="p-2 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Generate Password Setup Link"
                        disabled={loading || generatingLink === (user._id || user.id)}
                      >
                        {generatingLink === (user._id || user.id) ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                        ) : (
                          <FaLink className="w-5 h-5 text-blue-600" />
                        )}
                      </button>
                      <button
                        onClick={() => onEdit(user)}
                        className="p-2 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Edit"
                        disabled={loading}
                      >
                        <FaEdit className="w-5 h-5 text-green-600" />
                      </button>
                      <button
                        onClick={() => onDelete(user._id || user.id)}
                        className="p-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete"
                        disabled={loading}
                      >
                        <FaTrash className="w-5 h-5 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default UserList

