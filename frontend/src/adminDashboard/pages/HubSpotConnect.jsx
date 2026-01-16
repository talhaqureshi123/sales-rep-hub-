import { useState, useEffect } from 'react'
import { testHubSpotConnection, syncHubSpotData, importHubSpotCustomersToDb, importHubSpotTasksToDb, pushSalesOrdersToHubSpot } from '../../services/adminservices/hubspotService'
import { FaCheckCircle, FaUsers, FaCalendar, FaBullseye, FaChartLine, FaCloud, FaSync, FaSpinner, FaBell, FaShoppingCart, FaLink } from 'react-icons/fa'

const HubSpotConnect = () => {
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importingTasks, setImportingTasks] = useState(false)
  const [pushingOrders, setPushingOrders] = useState(false)

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
        alert(`Sync successful! ${result.data?.customers?.length || 0} customers, ${result.data?.orders?.length || 0} orders synced.`)
      } else {
        alert('Sync failed: ' + (result.message || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error syncing data:', error)
      alert('Error syncing data. Please check console for details.')
    } finally {
      setSyncing(false)
    }
  }

  const handleImportCustomers = async () => {
    setImporting(true)
    try {
      const result = await importHubSpotCustomersToDb()
      if (result.success) {
        const d = result.data || {}
        alert(`Imported from HubSpot: ${d.fetchedFromHubSpot || 0}\nCreated: ${d.created || 0}\nUpdated: ${d.updated || 0}\nSkipped (no email): ${d.skipped || 0}\n\nNow open Customers page to see them.`)
      } else {
        alert('Import failed: ' + (result.message || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error importing customers:', error)
      alert('Error importing customers. Please check console for details.')
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
        alert(`Imported HubSpot Tasks → Follow-Ups\nFetched: ${d.fetchedFromHubSpot || 0}\nCreated: ${d.created || 0}\nUpdated: ${d.updated || 0}\nSkipped: ${d.skipped || 0}\n\nNow open Follow-Up Manager to see them.`)
      } else {
        alert('Task import failed: ' + (result.message || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error importing tasks:', error)
      alert('Error importing tasks. Please check console for details.')
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
        alert(`Pushed Orders to HubSpot\nAttempted: ${d.attempted || 0}\nSynced: ${d.synced || 0}\nFailed: ${d.failed || 0}`)
      } else {
        alert('Push orders failed: ' + (result.message || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error pushing orders:', error)
      alert('Error pushing orders. Please check console for details.')
    } finally {
      setPushingOrders(false)
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
