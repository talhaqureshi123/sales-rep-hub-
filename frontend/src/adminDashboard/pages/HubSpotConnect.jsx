import { useState, useEffect } from 'react'
import { testHubSpotConnection, syncHubSpotData, importHubSpotCustomersToDb, importHubSpotTasksToDb, pushSalesOrdersToHubSpot, pushCustomersToHubSpot, pushTasksToHubSpot, pushQuotationsToHubSpot } from '../../services/adminservices/hubspotService'
import { FaCheckCircle, FaUsers, FaCloud, FaSync, FaSpinner, FaBell, FaLink } from 'react-icons/fa'
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
  const [pushingQuotations, setPushingQuotations] = useState(false)
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

  const handlePushQuotations = async () => {
    setPushingQuotations(true)
    try {
      const result = await pushQuotationsToHubSpot(false, 0)
      if (result.success) {
        const d = result.data || {}
        Swal.fire({
          icon: 'success',
          title: 'Pushed Quotes to HubSpot',
          html: d.attempted !== undefined ? `
            <div style="text-align: left;">
              <p><strong>Attempted:</strong> ${d.attempted || 0}</p>
              <p><strong>Synced:</strong> ${d.synced || 0}</p>
              <p><strong>Skipped:</strong> ${d.skipped || 0}</p>
              <p><strong>Failed:</strong> ${d.failed || 0}</p>
            </div>
          ` : (d.message || 'Quotations pushed to HubSpot successfully.'),
          confirmButtonColor: '#e9931c'
        })
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Push Quotes Failed',
          text: result.message || 'Unknown error',
          confirmButtonColor: '#e9931c'
        })
      }
    } catch (error) {
      console.error('Error pushing quotations:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error pushing quotes to HubSpot. Please check console for details.',
        confirmButtonColor: '#e9931c'
      })
    } finally {
      setPushingQuotations(false)
    }
  }

  // Order linking is auto-retried inside the backend push-orders endpoint now.

  const btnBase =
    'flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl font-semibold text-white whitespace-nowrap min-w-[180px] sm:min-w-[200px] font-hubspot ' +
    'bg-gradient-to-b from-[#e9931c] to-[#d8820a] shadow-md hover:shadow-xl hover:scale-[1.02] hover:from-[#d8820a] hover:to-[#c77209] ' +
    'active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#e9931c] focus:ring-offset-2 ' +
    'transition-all duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md disabled:hover:scale-100 disabled:active:scale-100 border border-amber-600/20';

  return (
    <div className="font-hubspot flex flex-col min-h-[100dvh] sm:min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/30 antialiased">
      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Header */}
        <div className="mb-8 transition-all duration-300">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 tracking-tight">
            HubSpot Connect
          </h1>
          <p className="text-gray-600 text-base sm:text-lg font-medium tracking-wide">
            Manage your HubSpot integration and sync data
          </p>
        </div>

        {/* Connection Status */}
      {connectionStatus === 'connected' && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6 flex items-start gap-4 shadow-sm hover:shadow-md transition-all duration-300 ease-out">
          <FaCheckCircle className="text-green-500 text-3xl mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-green-800 mb-1 text-lg">Successfully Connected</h3>
            <p className="text-green-700 text-sm font-medium leading-relaxed">
              HubSpot integration is configured at the platform level.
            </p>
            {testResult?.directApiTest && (
              <div className="mt-3 text-sm text-green-600 font-medium">
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
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6 flex items-start gap-4 shadow-sm hover:shadow-md transition-all duration-300 ease-out">
          <FaCheckCircle className="text-red-500 text-3xl mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-red-800 mb-1 text-lg">Connection Failed</h3>
            <p className="text-red-700 text-sm font-medium leading-relaxed">
              {testResult?.message || 'Unable to connect to HubSpot. Please check your configuration.'}
            </p>
            {testResult?.config?.hint && (
              <p className="mt-2 text-sm text-red-600 font-medium">{testResult.config.hint}</p>
            )}
            {testResult?.config?.authMode === 'oauth' && (
              <a
                href="/api/hubspot/authorize"
                className="inline-flex items-center gap-2 mt-3 px-5 py-2.5 bg-[#ff7a59] text-white rounded-xl font-semibold hover:bg-[#e66a4a] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-md hover:shadow-lg text-sm"
              >
                <FaLink className="w-4 h-4" />
                Connect with HubSpot
              </a>
            )}
            {testResult?.directApiTest?.error && (
              <div className="mt-2 text-sm text-red-600 font-medium">
                <p>Error: {testResult.directApiTest.error.message || 'Unknown error'}</p>
              </div>
            )}
          </div>
        </div>
      )}

        {/* Actions Section - options only; buttons in sticky footer below */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4 hover:shadow-md transition-shadow duration-300">
          {/* My Contacts Only Toggle */}
          <div className="mb-4 pb-4 border-b border-gray-200">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={myContactsOnly}
                onChange={(e) => setMyContactsOnly(e.target.checked)}
                className="w-5 h-5 text-[#e9931c] rounded focus:ring-2 focus:ring-[#e9931c] transition-transform checked:scale-110"
              />
              <div>
                <span className="text-sm font-bold text-gray-800 group-hover:text-gray-900 transition-colors">My Contacts Only</span>
                <p className="text-xs text-gray-500 mt-0.5 font-medium leading-relaxed">
                  Import/export only contacts assigned to you in HubSpot
                </p>
              </div>
            </label>
          </div>

          {/* Info Text */}
          <div className="text-sm text-gray-600 flex items-start gap-2 font-medium leading-relaxed">
            <FaLink className="mt-0.5 text-gray-500 flex-shrink-0" />
            <p>
              Orders are automatically linked to the matching HubSpot Contact (by email). If a link fails, it auto-retries on the next &quot;Push Orders&quot;.
            </p>
          </div>
        </div>
      </div>

      {/* Sticky footer - 4 buttons centered */}
      <div className="flex-shrink-0 border-t border-gray-200/80 bg-white/95 backdrop-blur-sm p-5 sm:p-6 pb-[calc(1rem+64px+env(safe-area-inset-bottom))] sm:pb-6">
        <div className="flex flex-wrap gap-4 sm:gap-6 justify-center max-w-3xl mx-auto">
          {/* Test Connection */}
          <button
            onClick={handleTestConnection}
            disabled={loading}
            className={btnBase}
          >
            {loading ? (
              <>
                <FaSpinner className="animate-spin w-4 h-4" />
                Testing...
              </>
            ) : (
              <>
                <FaCloud className="w-4 h-4 opacity-90" />
                Test Connection
              </>
            )}
          </button>

          {/* Sync Data */}
          <button
            onClick={handleSyncData}
            disabled={syncing || connectionStatus !== 'connected'}
            className={btnBase}
          >
            {syncing ? (
              <>
                <FaSpinner className="animate-spin w-4 h-4" />
                Syncing...
              </>
            ) : (
              <>
                <FaSync className="w-4 h-4 opacity-90" />
                Sync Data
              </>
            )}
          </button>

          {/* Import Customers */}
          <button
            onClick={handleImportCustomers}
            disabled={importing || connectionStatus !== 'connected'}
            className={btnBase}
          >
            {importing ? (
              <>
                <FaSpinner className="animate-spin w-4 h-4" />
                Importing...
              </>
            ) : (
              <>
                <FaUsers className="w-4 h-4 opacity-90" />
                Import Customers
              </>
            )}
          </button>

          {/* Import Tasks */}
          <button
            onClick={handleImportTasks}
            disabled={importingTasks || connectionStatus !== 'connected'}
            className={btnBase}
          >
            {importingTasks ? (
              <>
                <FaSpinner className="animate-spin w-4 h-4" />
                Importing Tasks...
              </>
            ) : (
              <>
                <FaBell className="w-4 h-4 opacity-90" />
                Import Tasks
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default HubSpotConnect
