import { useEffect, useState } from 'react'
import './App.css'
import { supabase } from './supabase'

const API_BASE = 'https://libreride-backend.libreride.workers.dev'

const SERVICE_LEVELS = [
  { value: 'regular', label: 'Regular' },
  { value: 'xl', label: 'XL' },
  { value: 'premium', label: 'Premium' },
  { value: 'premium_xl', label: 'Premium XL' },
]

function formatServiceLevel(value) {
  if (value === 'premium_xl') return 'Premium XL'
  if (value === 'premium') return 'Premium'
  if (value === 'xl') return 'XL'
  return 'Regular'
}

function formatServiceLevels(levels) {
  if (!Array.isArray(levels) || levels.length === 0) return 'None'
  return levels.map(formatServiceLevel).join(', ')
}

function statusLabel(value) {
  if (!value) return 'pending'
  return String(value).replaceAll('_', ' ')
}

function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [admin, setAdmin] = useState(null)
  const [email, setEmail] = useState('libreride@gmail.com')
  const [password, setPassword] = useState('')
  const [drivers, setDrivers] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [serviceSelections, setServiceSelections] = useState({})
  const [notes, setNotes] = useState({})
  const [rejectReasons, setRejectReasons] = useState({})

  useEffect(() => {
    restoreSession()
  }, [])

  async function restoreSession() {
    const { data } = await supabase.auth.getSession()

    if (!data.session) {
      return
    }

    const verified = await verifyAdmin(data.session.access_token)

    if (verified) {
      setLoggedIn(true)
      await loadDrivers(data.session.access_token)
    }
  }

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || null
  }

  async function apiFetch(path, options = {}) {
    const token = await getAccessToken()

    if (!token) {
      throw new Error('You are not logged in.')
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Request failed.')
    }

    return data
  }

  async function verifyAdmin(token) {
    try {
      const response = await fetch(`${API_BASE}/api/admin/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage(data.error || 'This account is not authorized as an admin.')
        return false
      }

      setAdmin(data.admin)
      setMessage('')
      return true
    } catch (error) {
      setMessage(error.message)
      return false
    }
  }

  async function login(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setLoading(false)
      setMessage(error.message)
      return
    }

    const verified = await verifyAdmin(data.session.access_token)

    if (!verified) {
      await supabase.auth.signOut()
      setLoggedIn(false)
      setLoading(false)
      return
    }

    setLoggedIn(true)
    await loadDrivers(data.session.access_token)
    setLoading(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    setLoggedIn(false)
    setAdmin(null)
    setDrivers([])
    setPassword('')
    setMessage('')
  }

  function initializeDriverSelections(driverList) {
    const nextSelections = {}
    const nextNotes = {}
    const nextRejectReasons = {}

    driverList.forEach((driver) => {
      const currentApproved = Array.isArray(driver.approved_service_levels)
        ? driver.approved_service_levels
        : []

      const requested = Array.isArray(driver.requested_service_levels)
        ? driver.requested_service_levels
        : ['regular']

      nextSelections[driver.id] =
        currentApproved.length > 0 ? currentApproved : requested

      nextNotes[driver.id] = driver.vehicle_service_notes || ''
      nextRejectReasons[driver.id] =
        driver.vehicle_rejection_reason ||
        driver.rejection_reason ||
        ''
    })

    setServiceSelections(nextSelections)
    setNotes(nextNotes)
    setRejectReasons(nextRejectReasons)
  }

  async function loadDrivers(existingToken = null) {
    setLoading(true)
    setMessage('')

    try {
      let data

      if (existingToken) {
        const response = await fetch(`${API_BASE}/api/admin/drivers/pending`, {
          headers: {
            Authorization: `Bearer ${existingToken}`,
          },
        })

        data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Could not load drivers.')
        }
      } else {
        data = await apiFetch('/api/admin/drivers/pending')
      }

      const driverList = Array.isArray(data.drivers) ? data.drivers : []
      setDrivers(driverList)
      initializeDriverSelections(driverList)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

 async function openDriverDocument(path) {
  if (!path) {
    setMessage('This file has not been uploaded yet.')
    return
  }

  setMessage('')

  try {
    const data = await apiFetch('/api/admin/driver-documents/signed-url', {
      method: 'POST',
      body: JSON.stringify({ path }),
    })

    if (!data.signedUrl) {
      setMessage('Could not open document.')
      return
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  } catch (error) {
    setMessage(error.message)
  }
}


  function driverDocuments(driver) {
    return [
      { label: 'Driver Photo / Selfie', path: driver.driver_photo_url },
      { label: 'License Front', path: driver.license_front_url },
      { label: 'License Back', path: driver.license_back_url },
      { label: 'Insurance Card', path: driver.insurance_card_url },
      { label: 'Vehicle Registration', path: driver.vehicle_registration_url },
      { label: 'Vehicle Front Photo', path: driver.vehicle_photo_front_url },
      { label: 'Vehicle Back Photo', path: driver.vehicle_photo_back_url },
      { label: 'Vehicle Left Side Photo', path: driver.vehicle_photo_left_url },
      { label: 'Vehicle Right Side Photo', path: driver.vehicle_photo_right_url },
      { label: 'Interior Front Photo', path: driver.vehicle_photo_interior_front_url },
      { label: 'Interior Back Seat Photo', path: driver.vehicle_photo_interior_back_url },
      { label: 'Trunk / Cargo Photo', path: driver.vehicle_photo_trunk_url },
    ]
  }

  function DocumentReview({ driver }) {
    const documents = driverDocuments(driver)
    const uploadedCount = documents.filter((doc) => Boolean(doc.path)).length

    return (
      <div className="approval-box">
        <h4>Uploaded Documents & Vehicle Photos</h4>
        <p>
          <strong>Upload Status:</strong> {uploadedCount} of {documents.length} uploaded
        </p>

        <div className="filter-row">
          {documents.map((doc) => (
            <button
              key={doc.label}
              type="button"
              onClick={() => openDriverDocument(doc.path)}
              disabled={!doc.path}
            >
              {doc.path ? `View ${doc.label}` : `Missing ${doc.label}`}
            </button>
          ))}
        </div>
      </div>
    )
  }

  function toggleServiceLevel(driverId, level) {
    setServiceSelections((current) => {
      const currentLevels = Array.isArray(current[driverId])
        ? current[driverId]
        : ['regular']

      if (level === 'regular') {
        return {
          ...current,
          [driverId]: currentLevels.includes('regular')
            ? currentLevels
            : ['regular', ...currentLevels],
        }
      }

      if (currentLevels.includes(level)) {
        const nextLevels = currentLevels.filter((item) => item !== level)
        return {
          ...current,
          [driverId]: nextLevels.length > 0 ? nextLevels : ['regular'],
        }
      }

      return {
        ...current,
        [driverId]: [...currentLevels, level],
      }
    })
  }

  async function approveDriver(driverId) {
    setLoading(true)
    setMessage('')

    try {
      const selectedLevels = serviceSelections[driverId] || ['regular']

      await apiFetch(`/api/admin/drivers/${driverId}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          approvedServiceLevels: selectedLevels,
          notes: notes[driverId] || null,
        }),
      })

      setMessage('Driver vehicle service level approved.')
      await loadDrivers()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function rejectDriver(driverId) {
    const reason = rejectReasons[driverId] || notes[driverId] || 'Vehicle rejected by admin.'

    setLoading(true)
    setMessage('')

    try {
      await apiFetch(`/api/admin/drivers/${driverId}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          reason,
          notes: notes[driverId] || reason,
        }),
      })

      setMessage('Driver rejected.')
      await loadDrivers()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function suspendDriver(driverId) {
    const reason = notes[driverId] || 'Vehicle service suspended by admin.'

    setLoading(true)
    setMessage('')

    try {
      await apiFetch(`/api/admin/drivers/${driverId}/suspend`, {
        method: 'POST',
        body: JSON.stringify({
          reason,
          notes: notes[driverId] || reason,
        }),
      })

      setMessage('Driver vehicle service suspended.')
      await loadDrivers()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  function filteredDrivers() {
    if (filter === 'all') return drivers

    if (filter === 'pending') {
      return drivers.filter((driver) =>
        driver.onboarding_status === 'pending_review' ||
        driver.vehicle_service_status === 'pending'
      )
    }

    if (filter === 'approved') {
      return drivers.filter((driver) =>
        driver.onboarding_status === 'approved' &&
        driver.vehicle_service_status === 'approved'
      )
    }

    if (filter === 'rejected') {
      return drivers.filter((driver) =>
        driver.onboarding_status === 'rejected' ||
        driver.vehicle_service_status === 'rejected'
      )
    }

    if (filter === 'suspended') {
      return drivers.filter((driver) =>
        driver.vehicle_service_status === 'suspended'
      )
    }

    return drivers
  }

  function driverName(driver) {
    const name = `${driver.first_name || ''} ${driver.last_name || ''}`.trim()
    return name || 'Unnamed Driver'
  }

  function vehicleName(driver) {
    const year = driver.vehicle_year || ''
    const make = driver.vehicle_make || ''
    const model = driver.vehicle_model || ''
    return `${year} ${make} ${model}`.trim() || 'Vehicle not provided'
  }

  function hasRequiredDocuments(driver) {
    return Boolean(
      driver.driver_photo_url &&
      driver.license_front_url &&
      driver.license_back_url &&
      driver.insurance_card_url &&
      driver.vehicle_registration_url &&
      driver.vehicle_photo_front_url &&
      driver.vehicle_photo_back_url &&
      driver.vehicle_photo_left_url &&
      driver.vehicle_photo_right_url &&
      driver.vehicle_photo_interior_front_url &&
      driver.vehicle_photo_interior_back_url &&
      driver.vehicle_photo_trunk_url
    )
  }

  if (!loggedIn) {
    return (
      <div className="admin-app">
        <section className="card login-card">
          <h1>LibreRide Admin</h1>
          <p>Sign in with your approved admin account.</p>

          <form onSubmit={login}>
            <input
              type="email"
              placeholder="Admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>

          {message && <p className="message">{message}</p>}
        </section>
      </div>
    )
  }

  const visibleDrivers = filteredDrivers()

  return (
    <div className="admin-app">
      <header className="card header-card">
        <div>
          <h1>LibreRide Admin</h1>
          <p>{admin?.email}</p>
        </div>

        <button type="button" onClick={logout}>Logout</button>
      </header>

      <section className="card">
        <h2>Vehicle Service Approval</h2>
        <p>Review driver vehicles, uploaded documents, and approve the service levels they can receive.</p>

        <div className="filter-row">
          <button type="button" onClick={() => setFilter('all')}>All</button>
          <button type="button" onClick={() => setFilter('pending')}>Pending</button>
          <button type="button" onClick={() => setFilter('approved')}>Approved</button>
          <button type="button" onClick={() => setFilter('rejected')}>Rejected</button>
          <button type="button" onClick={() => setFilter('suspended')}>Suspended</button>
          <button type="button" onClick={() => loadDrivers()} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {message && <p className="message">{message}</p>}
      </section>

      <section className="card">
        <h2>Drivers</h2>

        {visibleDrivers.length === 0 ? (
          <p>No drivers found for this filter.</p>
        ) : (
          visibleDrivers.map((driver) => (
            <div key={driver.id} className="driver-card">
              <div className="driver-card-header">
                <div>
                  <h3>{driverName(driver)}</h3>
                  <p>{driver.email || 'No email'}</p>
                </div>

                <div className="badge-group">
                  <span className="badge">Driver: {statusLabel(driver.onboarding_status)}</span>
                  <span className="badge">Vehicle: {statusLabel(driver.vehicle_service_status)}</span>
                  <span className="badge">
                    Docs: {hasRequiredDocuments(driver) ? 'complete' : 'missing'}
                  </span>
                </div>
              </div>

              <div className="grid">
                <p><strong>Vehicle:</strong> {vehicleName(driver)}</p>
                <p><strong>Vehicle Type:</strong> {driver.vehicle_type || 'Not provided'}</p>
                <p><strong>Color:</strong> {driver.vehicle_color || 'Not provided'}</p>
                <p><strong>Plate:</strong> {driver.vehicle_plate || 'Not provided'}</p>
                <p><strong>Seats:</strong> {driver.vehicle_seats || 'Not provided'}</p>
                <p><strong>Phone:</strong> {driver.phone || 'Not provided'}</p>
                <p><strong>License:</strong> {driver.license_number || 'Not provided'}</p>
                <p><strong>Background:</strong> {driver.background_check_status || 'not_started'}</p>
              </div>

              <div className="grid">
                <p><strong>Requested Services:</strong> {formatServiceLevels(driver.requested_service_levels)}</p>
                <p><strong>Currently Approved:</strong> {formatServiceLevels(driver.approved_service_levels)}</p>
                <p><strong>Driver Photo:</strong> {driver.driver_photo_url ? 'Uploaded' : 'Missing'}</p>
                <p><strong>License Front:</strong> {driver.license_front_url ? 'Uploaded' : 'Missing'}</p>
                <p><strong>License Back:</strong> {driver.license_back_url ? 'Uploaded' : 'Missing'}</p>
                <p><strong>Insurance:</strong> {driver.insurance_card_url ? 'Uploaded' : 'Missing'}</p>
                <p><strong>Registration:</strong> {driver.vehicle_registration_url ? 'Uploaded' : 'Missing'}</p>
                <p><strong>Vehicle Photos:</strong> {
                  driver.vehicle_photo_front_url &&
                  driver.vehicle_photo_back_url &&
                  driver.vehicle_photo_left_url &&
                  driver.vehicle_photo_right_url
                    ? 'Uploaded'
                    : 'Missing'
                }</p>
              </div>

              <DocumentReview driver={driver} />

              {driver.rejection_reason && (
                <p className="warning">
                  <strong>Driver Rejection Reason:</strong> {driver.rejection_reason}
                </p>
              )}

              {driver.vehicle_rejection_reason && (
                <p className="warning">
                  <strong>Vehicle Rejection Reason:</strong> {driver.vehicle_rejection_reason}
                </p>
              )}

              <div className="approval-box">
                <h4>Approve Service Levels</h4>

                {SERVICE_LEVELS.map((level) => (
                  <label key={level.value} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={(serviceSelections[driver.id] || ['regular']).includes(level.value)}
                      onChange={() => toggleServiceLevel(driver.id, level.value)}
                    />
                    <span>{level.label}</span>
                  </label>
                ))}
              </div>

              <label>Admin Notes</label>
              <textarea
                placeholder="Optional admin notes"
                value={notes[driver.id] || ''}
                onChange={(e) =>
                  setNotes((current) => ({
                    ...current,
                    [driver.id]: e.target.value,
                  }))
                }
              />

              <label>Reject Reason</label>
              <textarea
                placeholder="Reason if rejecting this driver or vehicle"
                value={rejectReasons[driver.id] || ''}
                onChange={(e) =>
                  setRejectReasons((current) => ({
                    ...current,
                    [driver.id]: e.target.value,
                  }))
                }
              />

              <div className="action-row">
                <button type="button" onClick={() => approveDriver(driver.id)} disabled={loading}>
                  Approve Selected Services
                </button>

                <button type="button" className="danger" onClick={() => rejectDriver(driver.id)} disabled={loading}>
                  Reject
                </button>

                <button type="button" className="warning-button" onClick={() => suspendDriver(driver.id)} disabled={loading}>
                  Suspend Vehicle
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  )
}

export default App