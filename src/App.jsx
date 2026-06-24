import { useEffect, useState } from 'react'
import './App.css'
import { supabase } from './supabase'

function App() {
  const [drivers, setDrivers] = useState([])
  const [rides, setRides] = useState([])
  const [ratings, setRatings] = useState([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadDashboard()

    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, loadDashboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, loadDashboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ratings' }, loadDashboard)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function loadDashboard() {
    const { data: driverData, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .order('created_at', { ascending: false })

    const { data: rideData, error: rideError } = await supabase
      .from('rides')
      .select('*')
      .order('created_at', { ascending: false })

    const { data: ratingData, error: ratingError } = await supabase
      .from('ratings')
      .select('*')
      .order('created_at', { ascending: false })

    if (driverError || rideError || ratingError) {
      setMessage(driverError?.message || rideError?.message || ratingError?.message)
      return
    }

    setDrivers(driverData || [])
    setRides(rideData || [])
    setRatings(ratingData || [])
  }

  async function approveDriver(driverId) {
    setMessage('')

    const { error } = await supabase
      .from('drivers')
      .update({
        onboarding_status: 'approved',
        background_check_status: 'approved',
        approved_at: new Date().toISOString(),
        rejected_at: null,
        rejection_reason: null,
      })
      .eq('id', driverId)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Driver approved.')
    await loadDashboard()
  }

  async function rejectDriver(driverId) {
    setMessage('')

    const reason = window.prompt('Reason for rejection?', 'Documents need review')

    const { error } = await supabase
      .from('drivers')
      .update({
        onboarding_status: 'rejected',
        background_check_status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: reason || 'Rejected by admin',
      })
      .eq('id', driverId)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Driver rejected.')
    await loadDashboard()
  }

  async function openDriverDocument(path) {
    if (!path) {
      setMessage('No document uploaded.')
      return
    }

    const { data, error } = await supabase.storage
      .from('driver-documents')
      .createSignedUrl(path, 60)

    if (error) {
      setMessage(error.message)
      return
    }

    window.open(data.signedUrl, '_blank')
  }

  function fare(ride) {
    return Number((ride.final_fare_cents || ride.estimated_fare_cents || 0) / 100)
  }

  function money(amount) {
    return `$${Number(amount || 0).toFixed(2)}`
  }

  function formatDate(value) {
    if (!value) return ''
    return new Date(value).toLocaleString()
  }

  function avgRating(driverId) {
    const driverRatings = ratings.filter((r) => r.driver_id === driverId)
    if (driverRatings.length === 0) return 'No ratings'
    const total = driverRatings.reduce((sum, r) => sum + Number(r.rating), 0)
    return `${(total / driverRatings.length).toFixed(1)} ★ (${driverRatings.length})`
  }

  function DriverDocuments({ driver }) {
    return (
      <>
        <p><strong>Documents:</strong></p>

        <button type="button" onClick={() => openDriverDocument(driver.license_front_url)}>
          View License Front
        </button>

        <button type="button" onClick={() => openDriverDocument(driver.license_back_url)}>
          View License Back
        </button>

        <button type="button" onClick={() => openDriverDocument(driver.insurance_card_url)}>
          View Insurance
        </button>
      </>
    )
  }

  const totalRides = rides.length
  const completedRides = rides.filter((r) => r.status === 'completed').length
  const activeRides = rides.filter((r) =>
    ['requested', 'accepted', 'arrived', 'in_progress'].includes(r.status)
  ).length
  const cancelledRides = rides.filter((r) => r.status === 'cancelled').length
  const declinedRides = rides.filter((r) => r.status === 'declined').length

  const totalDrivers = drivers.length
  const onlineDrivers = drivers.filter((d) => d.is_online).length
  const offlineDrivers = totalDrivers - onlineDrivers
  const pendingDrivers = drivers.filter((d) => d.onboarding_status === 'pending_review').length
  const approvedDrivers = drivers.filter((d) => d.onboarding_status === 'approved').length

  const totalRevenue = rides
    .filter((r) => r.status === 'completed')
    .reduce((sum, r) => sum + fare(r), 0)

  const averageFare = completedRides > 0 ? totalRevenue / completedRides : 0

  const totalDriverEarnings = drivers.reduce(
    (sum, d) => sum + Number(d.total_earnings || 0),
    0
  )

  const today = new Date().toDateString()

  const todayCompletedRides = rides.filter((r) => {
    if (r.status !== 'completed' || !r.completed_at) return false
    return new Date(r.completed_at).toDateString() === today
  })

  const todayRevenue = todayCompletedRides.reduce((sum, r) => sum + fare(r), 0)

  const activeRideList = rides.filter((r) =>
    ['requested', 'accepted', 'arrived', 'in_progress'].includes(r.status)
  )

  const pendingDriverList = drivers.filter((d) => d.onboarding_status === 'pending_review')

  return (
    <div className="driver-app">
      <header className="card">
        <h1>LibreRide Admin</h1>
        <p>Operations dashboard</p>
        <button type="button" onClick={loadDashboard}>Refresh Dashboard</button>
      </header>

      {message && <p>{message}</p>}

      <section className="card">
        <h2>Business Overview</h2>
        <p><strong>Total Rides:</strong> {totalRides}</p>
        <p><strong>Active Rides:</strong> {activeRides}</p>
        <p><strong>Completed Rides:</strong> {completedRides}</p>
        <p><strong>Cancelled Rides:</strong> {cancelledRides}</p>
        <p><strong>Declined Rides:</strong> {declinedRides}</p>
      </section>

      <section className="card">
        <h2>Revenue</h2>
        <p><strong>Total Revenue:</strong> {money(totalRevenue)}</p>
        <p><strong>Today Revenue:</strong> {money(todayRevenue)}</p>
        <p><strong>Average Fare:</strong> {money(averageFare)}</p>
        <p><strong>Total Driver Earnings:</strong> {money(totalDriverEarnings)}</p>
      </section>

      <section className="card">
        <h2>Drivers</h2>
        <p><strong>Total Drivers:</strong> {totalDrivers}</p>
        <p><strong>Pending Review:</strong> {pendingDrivers}</p>
        <p><strong>Approved Drivers:</strong> {approvedDrivers}</p>
        <p><strong>Online Drivers:</strong> {onlineDrivers}</p>
        <p><strong>Offline Drivers:</strong> {offlineDrivers}</p>
      </section>

      <section className="card">
        <h2>Pending Driver Approvals</h2>

        {pendingDriverList.length === 0 ? (
          <p>No pending drivers.</p>
        ) : (
          pendingDriverList.map((driver) => (
            <div key={driver.id} className="ride-card">
              <p><strong>Name:</strong> {driver.first_name || ''} {driver.last_name || ''}</p>
              <p><strong>Email:</strong> {driver.email || 'Unknown'}</p>
              <p><strong>Phone:</strong> {driver.phone || 'Not provided'}</p>
              <p><strong>License:</strong> {driver.license_number || 'Not provided'}</p>
              <p><strong>Vehicle:</strong> {driver.vehicle_year || ''} {driver.vehicle_make || ''} {driver.vehicle_model || ''}</p>
              <p><strong>Plate:</strong> {driver.vehicle_plate || 'Not provided'}</p>
              <p><strong>Status:</strong> {driver.onboarding_status || 'not_started'}</p>

              <DriverDocuments driver={driver} />

              <button className="approve-btn" type="button" onClick={() => approveDriver(driver.id)}>
                Approve
              </button>

              <button className="reject-btn" type="button" onClick={() => rejectDriver(driver.id)}>
                Reject
              </button>
            </div>
          ))
        )}
      </section>

      <section className="card">
        <h2>Active Rides</h2>

        {activeRideList.length === 0 ? (
          <p>No active rides.</p>
        ) : (
          activeRideList.map((ride) => (
            <div key={ride.id} className="ride-card">
              <p><strong>Status:</strong> {ride.status}</p>
              <p><strong>Pickup:</strong> {ride.pickup_address || 'Unknown'}</p>
              <p><strong>Dropoff:</strong> {ride.destination_address || 'Unknown'}</p>
              <p><strong>Fare:</strong> {money(fare(ride))}</p>
              <p><strong>Driver ID:</strong> {ride.driver_id || 'Unassigned'}</p>
              <p><strong>Created:</strong> {formatDate(ride.created_at)}</p>
            </div>
          ))
        )}
      </section>

      <section className="card">
        <h2>Driver Management</h2>

        {drivers.length === 0 ? (
          <p>No drivers found.</p>
        ) : (
          drivers.map((driver) => (
            <div key={driver.id} className="ride-card">
              <p><strong>Name:</strong> {driver.first_name || ''} {driver.last_name || ''}</p>
              <p><strong>Email:</strong> {driver.email || 'Unknown'}</p>
              <p><strong>Onboarding:</strong> {driver.onboarding_status || 'not_started'}</p>
              <p><strong>Availability:</strong> {driver.availability_status || 'offline'}</p>
              <p><strong>Online:</strong> {driver.is_online ? 'Yes' : 'No'}</p>
              <p><strong>Trips:</strong> {driver.total_trips || 0}</p>
              <p><strong>Earnings:</strong> {money(driver.total_earnings || 0)}</p>
              <p><strong>Rating:</strong> {avgRating(driver.id)}</p>

              <DriverDocuments driver={driver} />

              {driver.onboarding_status === 'pending_review' && (
                <>
                  <button className="approve-btn" type="button" onClick={() => approveDriver(driver.id)}>
                    Approve
                  </button>

                  <button className="reject-btn" type="button" onClick={() => rejectDriver(driver.id)}>
                    Reject
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </section>

      <section className="card">
        <h2>Recent Rides</h2>

        {rides.length === 0 ? (
          <p>No rides yet.</p>
        ) : (
          rides.slice(0, 15).map((ride) => (
            <div key={ride.id} className="ride-card">
              <p><strong>Status:</strong> {ride.status}</p>
              <p><strong>Pickup:</strong> {ride.pickup_address || 'Unknown'}</p>
              <p><strong>Dropoff:</strong> {ride.destination_address || 'Unknown'}</p>
              <p><strong>Fare:</strong> {money(fare(ride))}</p>
              <p><strong>Created:</strong> {formatDate(ride.created_at)}</p>
              {ride.completed_at && (
                <p><strong>Completed:</strong> {formatDate(ride.completed_at)}</p>
              )}
            </div>
          ))
        )}
      </section>

      <section className="card">
        <h2>Recent Ratings</h2>

        {ratings.length === 0 ? (
          <p>No ratings yet.</p>
        ) : (
          ratings.slice(0, 10).map((rating) => (
            <div key={rating.id} className="ride-card">
              <p><strong>Rating:</strong> {rating.rating} ★</p>
              <p><strong>Comment:</strong> {rating.comment || 'No comment'}</p>
              <p><strong>Driver ID:</strong> {rating.driver_id}</p>
              <p><strong>Date:</strong> {formatDate(rating.created_at)}</p>
            </div>
          ))
        )}
      </section>
    </div>
  )
}

export default App