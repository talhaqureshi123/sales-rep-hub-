import { useState } from 'react'
import { generatePasswordLink } from '../../services/adminservices/userService'
import { FaEdit, FaTrash, FaLink } from 'react-icons/fa'

const UserList = ({ users, onEdit, onDelete, onAddClick, loading }) => {
  const [passwordLink, setPasswordLink] = useState(null)
  const [generatingLink, setGeneratingLink] = useState(null)
  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 h-full min-h-0 flex flex-col">
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">Salesman Management</h2>
          <p className="text-gray-600 text-sm sm:text-base">Salesman List</p>
        </div>
        {onAddClick && (
          <button
            type="button"
            onClick={onAddClick}
            className="w-full sm:w-auto order-first sm:order-none text-white font-semibold py-2.5 px-4 rounded-lg shadow hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            style={{ backgroundColor: '#e9931c' }}
            disabled={loading}
          >
            <span className="text-lg leading-none">+</span>
            <span>Add Salesman</span>
          </button>
        )}
      </div>

      {/* Mobile: allow horizontal scroll so Delete button is not cut off; desktop: no horizontal scroll */}
      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-auto sm:overflow-x-hidden -mx-2 sm:mx-0 pr-1 sm:pr-0" style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="w-full border-collapse sm:table-fixed" style={{ minWidth: 400 }}>
          <colgroup>
            <col style={{ width: '50%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '30%' }} />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-gray-200 bg-gray-50/80">
              <th className="text-left py-3 px-3 text-gray-700 font-semibold text-sm">Name / Email</th>
              <th className="text-left py-3 px-3 text-gray-700 font-semibold text-sm whitespace-nowrap">Status</th>
              <th className="text-left py-3 px-3 text-gray-700 font-semibold text-sm whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="3" className="text-center py-8 text-gray-500 align-middle">
                  No salesmen found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user._id || user.id} className="border-b border-gray-100 hover:bg-orange-50/50 transition-colors align-middle">
                  <td className="py-3 px-3 min-w-0 align-middle">
                    <div className="font-medium text-gray-800 text-sm truncate" title={user.name}>{user.name}</div>
                    <div className="text-xs text-gray-500 truncate mt-0.5" title={user.email}>{user.email}</div>
                    <div className="text-xs text-gray-400 mt-0.5">Role: Salesman</div>
                  </td>
                  <td className="py-3 px-3 align-middle">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                        user.status === 'Active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="py-3 px-2 sm:px-3 align-middle">
                    <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 justify-start">
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
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[36px] min-h-[36px] flex items-center justify-center touch-manipulation"
                        title="Generate Password Setup Link"
                        disabled={loading || generatingLink === (user._id || user.id)}
                      >
                        {generatingLink === (user._id || user.id) ? (
                          <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-2 border-blue-600 border-t-transparent"></div>
                        ) : (
                          <FaLink className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                        )}
                      </button>
                      <button
                        onClick={() => onEdit(user)}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[36px] min-h-[36px] flex items-center justify-center touch-manipulation"
                        title="Edit"
                        disabled={loading}
                      >
                        <FaEdit className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                      </button>
                      <button
                        onClick={() => onDelete(user._id || user.id)}
                        className="p-1.5 sm:p-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[36px] min-h-[36px] flex items-center justify-center touch-manipulation"
                        title="Delete"
                        disabled={loading}
                      >
                        <FaTrash className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0" />
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

