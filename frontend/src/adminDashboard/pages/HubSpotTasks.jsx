import { useEffect, useMemo, useState } from 'react'
import { FaSearch, FaBell, FaSpinner, FaSync, FaUser } from 'react-icons/fa'
import { getFollowUps } from '../../services/adminservices/followUpService'
import { importHubSpotTasksToDb } from '../../services/adminservices/hubspotService'

const TABS = [
  { id: 'All', label: 'All' },
  { id: 'Overdue', label: 'Overdue' },
  { id: 'Today', label: 'Due today' },
  { id: 'Upcoming', label: 'Upcoming' },
]

const HubSpotTasks = () => {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [activeTab, setActiveTab] = useState('All')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let list = tasks
    if (activeTab !== 'All') list = list.filter((t) => t.status === activeTab)
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      list = list.filter((t) => {
        return (
          (t.description || '').toLowerCase().includes(s) ||
          (t.customerName || '').toLowerCase().includes(s) ||
          (t.customerEmail || '').toLowerCase().includes(s)
        )
      })
    }
    return list
  }, [tasks, activeTab, search])

  const load = async () => {
    setLoading(true)
    try {
      const res = await getFollowUps({ source: 'hubspot', status: 'All' })
      if (res.success) {
        setTasks(res.data || [])
      } else {
        setTasks([])
      }
    } catch (e) {
      console.error(e)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleImport = async () => {
    setImporting(true)
    try {
      const res = await importHubSpotTasksToDb()
      if (!res.success) {
        alert(res.message || 'Task import failed')
      }
      await load()
    } catch (e) {
      console.error(e)
      alert('Task import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tasks</h1>
          <p className="text-gray-600">HubSpot tasks imported into Follow-Ups</p>
        </div>
        <button
          onClick={handleImport}
          disabled={importing}
          className="flex items-center gap-2 bg-[#e9931c] hover:bg-[#d88419] text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
        >
          {importing ? <FaSpinner className="animate-spin" /> : <FaSync />}
          Import from HubSpot
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 p-4 border-b border-gray-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === t.id ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex items-center gap-2 w-full md:max-w-md bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <FaSearch className="text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search task title or contact…"
              className="w-full bg-transparent outline-none text-sm"
            />
          </div>
          <div className="text-sm text-gray-600">
            {loading ? 'Loading…' : `${filtered.length} tasks`}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-t border-b border-gray-200">
              <tr className="text-left text-gray-600">
                <th className="px-4 py-3 w-32">Status</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Associated contact</th>
                <th className="px-4 py-3 w-40">Due date</th>
                <th className="px-4 py-3 w-40">Assigned to</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6" colSpan={5}>
                    <div className="flex items-center gap-2 text-gray-600">
                      <FaSpinner className="animate-spin" />
                      Loading tasks…
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-gray-600" colSpan={5}>
                    No tasks found. Click <b>Import from HubSpot</b> to pull tasks.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          t.status === 'Overdue'
                            ? 'bg-red-50 text-red-700'
                            : t.status === 'Today'
                              ? 'bg-yellow-50 text-yellow-700'
                              : t.status === 'Upcoming'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-green-50 text-green-700'
                        }`}
                      >
                        <FaBell />
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {t.description || '—'}
                      {t.notes ? <div className="text-xs text-gray-500 mt-1 line-clamp-2">{t.notes}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div className="flex items-center gap-2">
                        <FaUser className="text-gray-400" />
                        <div>
                          <div className="font-medium">{t.customerName || '—'}</div>
                          {t.customerEmail ? <div className="text-xs text-gray-500">{t.customerEmail}</div> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {t.dueDate ? new Date(t.dueDate).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {t.salesman?.name || 'Admin'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default HubSpotTasks

