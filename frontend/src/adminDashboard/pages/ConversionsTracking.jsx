import { useState, useEffect } from 'react'
import { FaCheckCircle, FaFileInvoice, FaMapMarkerAlt, FaRoute, FaComments, FaImage } from 'react-icons/fa'

const ConversionsTracking = () => {
  const [loading, setLoading] = useState(true)
  const [visitTargets, setVisitTargets] = useState([])
  const [filter, setFilter] = useState('all') // all, completed, with-quotations
  const [selectedTarget, setSelectedTarget] = useState(null)

  useEffect(() => {
    loadData()
  }, [filter])

  const loadData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      if (!token) {
        console.error('No token found')
        return
      }

      // Load all visit targets with conversions
      const response = await fetch('/api/admin/visit-targets', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()
      if (result.success && result.data) {
        let filtered = result.data

        // Apply filters
        if (filter === 'completed') {
          filtered = filtered.filter(vt => vt.status === 'Completed')
        } else if (filter === 'with-quotations') {
          filtered = filtered.filter(vt => vt.quotationCreated === true)
        }

        // Sort by completed date (most recent first)
        filtered.sort((a, b) => {
          if (a.completedAt && b.completedAt) {
            return new Date(b.completedAt) - new Date(a.completedAt)
          }
          return 0
        })

        setVisitTargets(filtered)
      }
    } catch (error) {
      console.error('Error loading conversions:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#e9931c] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading conversions...</p>
        </div>
      </div>
    )
  }

  const completedCount = visitTargets.filter(vt => vt.status === 'Completed').length
  const withQuotationsCount = visitTargets.filter(vt => vt.quotationCreated).length
  const totalDistance = visitTargets
    .filter(vt => vt.actualKilometers)
    .reduce((sum, vt) => sum + parseFloat(vt.actualKilometers || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Conversions & Tracking</h1>
          <p className="text-gray-600 mt-1">View all visit target completions, meter readings, and conversions</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed Targets</p>
              <p className="text-3xl font-bold text-gray-800">{completedCount}</p>
            </div>
            <FaCheckCircle className="text-4xl text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">With Quotations</p>
              <p className="text-3xl font-bold text-gray-800">{withQuotationsCount}</p>
            </div>
            <FaFileInvoice className="text-4xl text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Distance</p>
              <p className="text-3xl font-bold text-gray-800">{totalDistance.toFixed(2)} km</p>
            </div>
            <FaRoute className="text-4xl text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Targets</p>
              <p className="text-3xl font-bold text-gray-800">{visitTargets.length}</p>
            </div>
            <FaMapMarkerAlt className="text-4xl text-purple-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-[#e9931c] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Targets
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filter === 'completed'
                ? 'bg-[#e9931c] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Completed Only
          </button>
          <button
            onClick={() => setFilter('with-quotations')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filter === 'with-quotations'
                ? 'bg-[#e9931c] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            With Quotations
          </button>
        </div>
      </div>

      {/* Visit Targets List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Target Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Salesman
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Distance (km)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Meter Reading
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quotation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Completed At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {visitTargets.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                    No visit targets found
                  </td>
                </tr>
              ) : (
                visitTargets.map((target) => (
                  <tr key={target._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{target.name}</div>
                      <div className="text-sm text-gray-500">{target.address || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {target.salesman?.name || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {target.salesman?.email || ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          target.status === 'Completed'
                            ? 'bg-green-100 text-green-800'
                            : target.status === 'In Progress'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {target.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {target.actualKilometers ? (
                        <div>
                          <div className="font-semibold">{target.actualKilometers} km</div>
                          {target.estimatedKilometers && (
                            <div className="text-xs text-gray-500">
                              Est: {target.estimatedKilometers} km
                            </div>
                          )}
                        </div>
                      ) : target.estimatedKilometers ? (
                        <div className="text-gray-600">Est: {target.estimatedKilometers} km</div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {target.startingKilometers && target.endingKilometers ? (
                        <div>
                          <div className="font-semibold">
                            {target.startingKilometers} → {target.endingKilometers} km
                          </div>
                          {target.meterImage && (
                            <div className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                              <FaImage className="w-3 h-3" />
                              Image uploaded
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {target.quotationCreated ? (
                        <div className="flex items-center gap-2">
                          <FaFileInvoice className="text-green-500" />
                          <span className="text-sm text-green-700 font-semibold">Created</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {target.completedAt
                        ? new Date(target.completedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedTarget(target)}
                        className="text-[#e9931c] hover:text-[#d8820a] font-semibold"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-[#e9931c] to-[#d8820a] rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedTarget.name}</h3>
                  <p className="text-sm text-orange-100 mt-1">Visit Target Details</p>
                </div>
                <button
                  onClick={() => setSelectedTarget(null)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Address</p>
                  <p className="font-semibold text-gray-900">{selectedTarget.address || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      selectedTarget.status === 'Completed'
                        ? 'bg-green-100 text-green-800'
                        : selectedTarget.status === 'In Progress'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {selectedTarget.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Salesman</p>
                  <p className="font-semibold text-gray-900">
                    {selectedTarget.salesman?.name || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Priority</p>
                  <p className="font-semibold text-gray-900">{selectedTarget.priority || 'Medium'}</p>
                </div>
              </div>

              {/* Distance & Meter Reading */}
              {(selectedTarget.actualKilometers || selectedTarget.startingKilometers) && (
                <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                    <FaRoute className="w-5 h-5" />
                    Distance & Meter Reading
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedTarget.actualKilometers && (
                      <div>
                        <p className="text-sm text-blue-600">Actual Distance</p>
                        <p className="text-2xl font-bold text-blue-700">
                          {selectedTarget.actualKilometers} km
                        </p>
                      </div>
                    )}
                    {selectedTarget.estimatedKilometers && (
                      <div>
                        <p className="text-sm text-blue-600">Estimated Distance</p>
                        <p className="text-xl font-semibold text-blue-700">
                          {selectedTarget.estimatedKilometers} km
                        </p>
                      </div>
                    )}
                    {selectedTarget.startingKilometers && (
                      <div>
                        <p className="text-sm text-blue-600">Starting Reading</p>
                        <p className="text-xl font-semibold text-blue-700">
                          {selectedTarget.startingKilometers} km
                        </p>
                      </div>
                    )}
                    {selectedTarget.endingKilometers && (
                      <div>
                        <p className="text-sm text-blue-600">Ending Reading</p>
                        <p className="text-xl font-semibold text-blue-700">
                          {selectedTarget.endingKilometers} km
                        </p>
                      </div>
                    )}
                  </div>
                  {selectedTarget.meterImage && (
                    <div className="mt-4">
                      <p className="text-sm text-blue-600 mb-2">Meter Image</p>
                      <img
                        src={selectedTarget.meterImage}
                        alt="Meter reading"
                        className="max-w-full h-48 object-contain border-2 border-blue-200 rounded-lg"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Quotation Info */}
              {selectedTarget.quotationCreated && (
                <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                  <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                    <FaFileInvoice className="w-5 h-5" />
                    Quotation Created
                  </h4>
                  <p className="text-sm text-green-700">
                    A quotation has been created for this visit target.
                  </p>
                </div>
              )}

              {/* Comments */}
              {selectedTarget.comments && (
                <div className="bg-yellow-50 rounded-lg p-4 border-2 border-yellow-200">
                  <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                    <FaComments className="w-5 h-5" />
                    Comments
                  </h4>
                  <p className="text-sm text-yellow-900">{selectedTarget.comments}</p>
                </div>
              )}

              {/* Notes */}
              {selectedTarget.notes && (
                <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
                  <h4 className="font-semibold text-gray-800 mb-2">Notes</h4>
                  <p className="text-sm text-gray-700">{selectedTarget.notes}</p>
                </div>
              )}

              {/* Completion Date */}
              {selectedTarget.completedAt && (
                <div className="text-sm text-gray-600">
                  <span className="font-semibold">Completed at:</span>{' '}
                  {new Date(selectedTarget.completedAt).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConversionsTracking
