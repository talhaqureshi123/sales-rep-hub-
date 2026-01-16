const MilestoneModal = ({ milestone, onClose, onQuotation, onAchievement, onConversion }) => {
  if (!milestone) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-800">{milestone.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{milestone.address}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              <span className="font-semibold">Status:</span>{' '}
              <span className={`px-2 py-1 rounded-full text-xs ${
                milestone.status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {milestone.status}
              </span>
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Priority:</span> {milestone.priority}
            </p>
          </div>

          <p className="text-gray-700 mb-6">
            Select an action for this milestone:
          </p>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => {
                if (onQuotation) onQuotation(milestone)
                onClose()
              }}
              className="w-full px-4 py-3 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-xl">📄</span>
              <span>Create Quotation</span>
            </button>

            <button
              onClick={() => {
                if (onAchievement) onAchievement(milestone)
                onClose()
              }}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-xl">🏆</span>
              <span>Mark as Achieved</span>
            </button>

            <button
              onClick={() => {
                if (onConversion) onConversion(milestone)
                onClose()
              }}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-xl">💰</span>
              <span>Track Conversion</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MilestoneModal

