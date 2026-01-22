import { useState, useEffect } from 'react'
import { testHubSpotConnection, syncHubSpotData, importHubSpotCustomersToDb, importHubSpotTasksToDb, pushSalesOrdersToHubSpot, pushCustomersToHubSpot, pushTasksToHubSpot } from '../../services/adminservices/hubspotService'
import { FaCheckCircle, FaUsers, FaCalendar, FaBullseye, FaChartLine, FaCloud, FaSync, FaSpinner, FaBell, FaShoppingCart, FaLink, FaTasks, FaUserPlus } from 'react-icons/fa'
import Swal from 'sweetalert2'

const HubSpotConnect = () => {
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importingTasks, setImportingTasks] = useState(false)
  const [pushingOrders, setPushingOrders] = useState(false)
  const [pushingCustomers, setPushingCustomers] = useState(false)
  const [pushingTasks, setPushingTasks] = useState(false)
  const [myContactsOnly, setMyContactsOnly] = useState(false)

  useEffect(() => {
    // Check connection status on mount
    checkConnection()
  }, [])

  const checkConnection = async () => {
    setLoading(true)
    try {
      const result = await testHubSpotConnection()
      if (result.success) {
        setConnectionStatus('connected')
        setTestResult(result)
      } else {
        setConnectionStatus('disconnected')
        setTestResult(result)
      }
    } catch (error) {
      console.error('Error checking connection:', error)
      setConnectionStatus('error')
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async () => {
    setLoading(true)
    try {
      const result = await testHubSpotConnection()
      setTestResult(result)
      
      if (result.success && result.directApiTest?.success) {
        setConnectionStatus('connected')
      } else {
        setConnectionStatus('disconnected')
      }
    } catch (error) {
      console.error('Error testing connection:', error)
      setConnectionStatus('error')
    } finally {
      setLoading(false)
    }
  }

  const handleSyncData = async () => {
    setSyncing(true)
    try {
      const result = await syncHubSpotData()
      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Sync Successful!',
          html: `Synced: ${result.data?.customers?.length || 0} customers, ${result.data?.orders?.length || 0} orders`,
          confirmButtonColor: '#e9931c'
        })
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Sync Failed',
          text: result.message || 'Unknown error',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error syncing data:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error syncing data. Please check console for details.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleImportCustomers = async () => {
    setImporting(true)
    try {
      const result = await importHubSpotCustomersToDb(myContactsOnly)
      if (result.success) {
        const d = result.data || {}
        Swal.fire({
          icon: 'success',
          title: 'Import Successful!',
          html: `
            <div style="text-align: left;">
              <p><strong>Imported from HubSpot:</strong> ${d.fetchedFromHubSpot || 0}</p>
              <p><strong>Created:</strong> ${d.created || 0}</p>
              <p><strong>Updated:</strong> ${d.updated || 0}</p>
              <p><strong>Skipped (no email):</strong> ${d.skipped || 0}</p>
              ${myContactsOnly ? '<p class="text-blue-600 font-semibold mt-2">✓ Only MY contacts imported</p>' : ''}
              <hr style="margin: 10px 0;">
              <p>Now open Customers page to see them.</p>
            </div>
          `,
          confirmButtonColor: '#e9931c'
        })
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Import Failed',
          text: result.message || 'Unknown error',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error importing customers:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error importing customers. Please check console for details.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setImporting(false)
    }
  }

  const handleImportTasks = async () => {
    setImportingTasks(true)
    try {
      const result = await importHubSpotTasksToDb()
      if (result.success) {
        const d = result.data || {}
        Swal.fire({
          icon: 'success',
          title: 'Import Successful!',
          html: `
            <div style="text-align: left;">
              <p><strong>Imported HubSpot Tasks → Follow-Ups</strong></p>
              <p><strong>Fetched:</strong> ${d.fetchedFromHubSpot || 0}</p>
              <p><strong>Created:</strong> ${d.created || 0}</p>
              <p><strong>Updated:</strong> ${d.updated || 0}</p>
              <p><strong>Skipped:</strong> ${d.skipped || 0}</p>
              <hr style="margin: 10px 0;">
              <p>Now open Follow-Up Manager to see them.</p>
            </div>
          `,
          confirmButtonColor: '#e9931c'
        })
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Task Import Failed',
          text: result.message || 'Unknown error',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error importing tasks:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error importing tasks. Please check console for details.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setImportingTasks(false)
    }
  }

  const handlePushOrders = async () => {
    setPushingOrders(true)
    try {
      const result = await pushSalesOrdersToHubSpot(false, 0)
      if (result.success) {
        const d = result.data || {}
        Swal.fire({
          icon: 'success',
          title: 'Pushed Orders to HubSpot',
          html: `
            <div style="text-align: left;">
              <p><strong>Attempted:</strong> ${d.attempted || 0}</p>
              <p><strong>Synced:</strong> ${d.synced || 0}</p>
              <p><strong>Failed:</strong> ${d.failed || 0}</p>
            </div>
          `,
          confirmButtonColor: '#e9931c'
        })
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Push Orders Failed',
          text: result.message || 'Unknown error',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error pushing orders:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error pushing orders. Please check console for details.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setPushingOrders(false)
    }
  }

  const handlePushCustomers = async () => {
    setPushingCustomers(true)
    try {
      const result = await pushCustomersToHubSpot(false, 0, myContactsOnly)
      if (result.success) {
        const d = result.data || {}
        Swal.fire({
          icon: 'success',
          title: 'Pushed Customers to HubSpot',
          html: `
            <div style="text-align: left;">
              <p><strong>Attempted:</strong> ${d.attempted || 0}</p>
              <p><strong>Synced:</strong> ${d.synced || 0}</p>
              <p><strong>Skipped:</strong> ${d.skipped || 0}</p>
              <p><strong>Failed:</strong> ${d.failed || 0}</p>
              ${myContactsOnly ? '<p class="text-blue-600 font-semibold mt-2">✓ Contacts assigned to YOU in HubSpot</p>' : ''}
            </div>
          `,
          confirmButtonColor: '#e9931c'
        })
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Push Customers Failed',
          text: result.message || 'Unknown error',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error pushing customers:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error pushing customers. Please check console for details.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setPushingCustomers(false)
    }
  }

  const handlePushTasks = async () => {
    setPushingTasks(true)
    try {
      const result = await pushTasksToHubSpot(false, 0)
      if (result.success) {
        const d = result.data || {}
        Swal.fire({
          icon: 'success',
          title: 'Pushed Tasks to HubSpot',
          html: `
            <div style="text-align: left;">
              <p><strong>Attempted:</strong> ${d.attempted || 0}</p>
              <p><strong>Synced:</strong> ${d.synced || 0}</p>
              <p><strong>Skipped:</strong> ${d.skipped || 0}</p>
              <p><strong>Failed:</strong> ${d.failed || 0}</p>
            </div>
          `,
          confirmButtonColor: '#e9931c'
        })
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Push Tasks Failed',
          text: result.message || 'Unknown error',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error pushing tasks:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error pushing tasks. Please check console for details.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setPushingTasks(false)
    }
  }

  // Order linking is auto-retried inside the backend push-orders endpoint now.

  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 via-white to-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">HubSpot Connect</h1>
        <p className="text-gray-600">Manage your HubSpot integration and sync data</p>
      </div>

      {/* Connection Status */}
      {connectionStatus === 'connected' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <FaCheckCircle className="text-green-500 text-2xl mt-1" />
          <div className="flex-1">
            <h3 className="font-semibold text-green-800 mb-1">Successfully Connected</h3>
            <p className="text-green-700 text-sm">
              HubSpot integration is configured at the platform level.
            </p>
            {testResult?.directApiTest && (
              <div className="mt-2 text-sm text-green-600">
                <p>API Status: {testResult.directApiTest.success ? '✅ Working' : '❌ Failed'}</p>
                {testResult.testResults && (
                  <p className="mt-1">
                    Customers: {testResult.testResults.customers.fetched || 0} | 
                    Orders: {testResult.testResults.orders.fetched || 0}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {connectionStatus === 'disconnected' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <FaCheckCircle className="text-red-500 text-2xl mt-1" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-800 mb-1">Connection Failed</h3>
            <p className="text-red-700 text-sm">
              {testResult?.message || 'Unable to connect to HubSpot. Please check your configuration.'}
            </p>
            {testResult?.directApiTest?.error && (
              <div className="mt-2 text-sm text-red-600">
                <p>Error: {testResult.directApiTest.error.message || 'Unknown error'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {/* My Contacts Only Toggle */}
        <div className="mb-4 pb-4 border-b border-gray-200">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={myContactsOnly}
              onChange={(e) => setMyContactsOnly(e.target.checked)}
              className="w-5 h-5 text-[#e9931c] rounded focus:ring-[#e9931c]"
            />
            <div>
              <span className="text-sm font-semibold text-gray-800">My Contacts Only</span>
              <p className="text-xs text-gray-500 mt-0.5">
                Import/export only contacts assigned to you in HubSpot
              </p>
            </div>
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Test Connection Button */}
          <button
            onClick={handleTestConnection}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap min-w-[190px]"
          >
            {loading ? (
              <>
                <FaSpinner className="animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <FaCloud />
                Test Connection
              </>
            )}
          </button>

          {/* Sync Data Button */}
          <button
            onClick={handleSyncData}
            disabled={syncing || connectionStatus !== 'connected'}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap min-w-[190px]"
          >
            {syncing ? (
              <>
                <FaSpinner className="animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <FaSync />
                Sync Data
              </>
            )}
          </button>

          {/* Import Customers Button */}
          <button
            onClick={handleImportCustomers}
            disabled={importing || connectionStatus !== 'connected'}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap min-w-[190px]"
          >
            {importing ? (
              <>
                <FaSpinner className="animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <FaUsers />
                Import Customers
              </>
            )}
          </button>

          {/* Import Tasks Button */}
          <button
            onClick={handleImportTasks}
            disabled={importingTasks || connectionStatus !== 'connected'}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap min-w-[190px]"
          >
            {importingTasks ? (
              <>
                <FaSpinner className="animate-spin" />
                Importing Tasks...
              </>
            ) : (
              <>
                <FaBell />
                Import Tasks
              </>
            )}
          </button>

          {/* Push Existing Orders Button */}
          <button
            onClick={handlePushOrders}
            disabled={pushingOrders || connectionStatus !== 'connected'}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap min-w-[190px]"
          >
            {pushingOrders ? (
              <>
                <FaSpinner className="animate-spin" />
                Pushing Orders...
              </>
            ) : (
              <>
                <FaShoppingCart />
                Push Orders (Auto-Link)
              </>
            )}
          </button>

          {/* Push Customers Button */}
          <button
            onClick={handlePushCustomers}
            disabled={pushingCustomers || connectionStatus !== 'connected'}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap min-w-[190px]"
          >
            {pushingCustomers ? (
              <>
                <FaSpinner className="animate-spin" />
                Pushing Customers...
              </>
            ) : (
              <>
                <FaUserPlus />
                Push Customers
              </>
            )}
          </button>

          {/* Push Tasks Button */}
          <button
            onClick={handlePushTasks}
            disabled={pushingTasks || connectionStatus !== 'connected'}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#e9931c] text-white rounded-lg font-semibold hover:bg-[#d8820a] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap min-w-[190px]"
          >
            {pushingTasks ? (
              <>
                <FaSpinner className="animate-spin" />
                Pushing Tasks...
              </>
            ) : (
              <>
                <FaTasks />
                Push Tasks
              </>
            )}
          </button>
        </div>

        {/* Info Text */}
        <div className="mt-4 text-sm text-gray-600 flex items-start gap-2">
          <FaLink className="mt-0.5 text-gray-500" />
          <p>
            Orders are automatically linked to the matching HubSpot Contact (by email). If a link fails, it auto-retries on the next "Push Orders".
          </p>
        </div>
      </div>
    </div>
  )
}

export default HubSpotConnect
