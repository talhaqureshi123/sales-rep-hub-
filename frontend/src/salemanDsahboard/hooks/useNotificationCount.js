import { useState, useEffect } from 'react'
import { getMyFollowUps } from '../../services/salemanservices/followUpService'
import { getVisitTargets } from '../../services/salemanservices/visitTargetService'
import { getMySamples } from '../../services/salemanservices/sampleService'

// Mark all current notifications as seen
export const markAllNotificationsAsSeen = () => {
  // Store timestamp when notifications page was opened
  localStorage.setItem('notificationsLastSeen', new Date().toISOString())
}

// Get notification item creation/update time
const getItemTimestamp = (item, type) => {
  // Prefer createdAt, fallback to updatedAt
  if (item.createdAt) {
    return new Date(item.createdAt)
  }
  if (item.updatedAt) {
    return new Date(item.updatedAt)
  }
  // If no timestamp, consider it old (won't show as new)
  return new Date(0)
}

export const useNotificationCount = () => {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNotificationCount()
    // Refresh every 30 seconds
    const interval = setInterval(loadNotificationCount, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadNotificationCount = async () => {
    try {
      setLoading(true)
      let tasks = []
      let visits = []
      let samples = []

      // Load tasks (non-completed)
      const tasksResult = await getMyFollowUps({})
      if (tasksResult.success && tasksResult.data) {
        tasks = tasksResult.data.filter(t => t.status !== 'Completed')
      }

      // Load visits (non-completed)
      const visitsResult = await getVisitTargets({})
      if (visitsResult.success && visitsResult.data) {
        visits = visitsResult.data.filter(v => v.status !== 'Completed')
      }

      // Load samples (non-converted)
      const samplesResult = await getMySamples({})
      if (samplesResult.success && samplesResult.data) {
        samples = samplesResult.data.filter(s => s.status !== 'Converted')
      }

      // Get last seen timestamp
      const lastSeenTimestamp = localStorage.getItem('notificationsLastSeen')
      const lastSeenTime = lastSeenTimestamp ? new Date(lastSeenTimestamp) : null

      // If notifications were never seen, count all active items
      if (!lastSeenTime) {
        setCount(tasks.length + visits.length + samples.length)
        return
      }

      // Count only NEW notifications (created/updated after last seen)
      let newCount = 0

      // Check tasks
      tasks.forEach(task => {
        const itemTime = getItemTimestamp(task, 'task')
        if (itemTime > lastSeenTime) {
          newCount++
        }
      })

      // Check visits
      visits.forEach(visit => {
        const itemTime = getItemTimestamp(visit, 'visit')
        if (itemTime > lastSeenTime) {
          newCount++
        }
      })

      // Check samples
      samples.forEach(sample => {
        const itemTime = getItemTimestamp(sample, 'sample')
        if (itemTime > lastSeenTime) {
          newCount++
        }
      })

      setCount(newCount)
    } catch (error) {
      console.error('Error loading notification count:', error)
    } finally {
      setLoading(false)
    }
  }

  return { count, loading, refresh: loadNotificationCount }
}
