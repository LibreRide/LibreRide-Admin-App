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

  const totalRides = rides.length
  const activeRides = rides.filter((r) =>
    ['requested', 'accepted', 'arrived', 'in_progress'].includes(r.status)
  ).length
  const completedRides = rides.filter((r) => r.status === 'completed').length
  const onlineDrivers = drivers.filter((d) => d.is_online).length
  const totalEarnings = drivers.reduce((sum, d) => sum + Number(d.total_earnings || 0), 0)

  function avgRating(driverId) {
    const driverRatings = ratings.filter((r) => r.driver_id === driverId)
    if (driverRatings.length === 0) return 'No ratings'
    const total = driverRatings.reduce((sum, r) => sum + Number(r.rating), 0)
    return `${(total / driverRatings.length).toFixed(1)} ★`
  }

  function fare(ride) {
    return `$${((ride.final_fare_cents || ride.estimated_fare_cents || 0) / 100).toFixed(2)}`
  }

  return (
    <div className="driver-app">
      <header className="card">
        <h1>LibreRide Admin</h1>
        <p>Operations dashboard</p>
      </header>

      {message && <p>{message}</p>}

      <section className="card">
        <h2>Overview</h2>
        <p><strong>Total Rides:</strong> {totalRides}</p>
        <p><strong>Active Rides:</strong> {activeRides}</p>
        <p><strong>Completed Rides:</strong> {completedRides}</p>
        <p><strong>Online Drivers:</strong> {onlineDrivers}</p>
        <p><strong>Total Driver Earnings:</strong> ${totalEarnings.toFixed(2)}</p>
      </section>

      <section className="card">
        <h2>Active Rides</h2>
        {rides.filter((r) => ['requested', 'accepted', 'arrived', 'in_progress'].includes(r.status)).length === 0 ? (
          <p>No active rides.</p>
        ) : (
          rides
            .filter((r) => ['requested', 'accepted', 'arrived', 'in_progress'].includes(r.status))
            .map((ride) => (
              <div key={ride.id} className="ride-card">
                <p><strong>Status:</strong> {ride.status}</p>
                <p><strong>Pickup:</strong> {ride.pickup_address || 'Unknown'}</p>
                <p><strong>Dropoff:</strong> {ride.destination_address || 'Unknown'}</p>
                <p><strong>Fare:</strong> {fare(ride)}</p>
                <p><strong>Driver ID:</strong> {ride.driver_id || 'Unassigned'}</p>
              </div>
            ))
        )}
      </section>

      <section className="card">
        <h2>Drivers</h2>
        {drivers.length === 0 ? (
          <p>No drivers found.</p>
        ) : (
          drivers.map((driver) => (
            <div key={driver.id} className="ride-card">
              <p><strong>Email:</strong> {driver.email || 'Unknown'}</p>
              <p><strong>Status:</strong> {driver.availability_status || 'offline'}</p>
              <p><strong>Online:</strong> {driver.is_online ? 'Yes' : 'No'}</p>
              <p><strong>Trips:</strong> {driver.total_trips || 0}</p>
              <p><strong>Earnings:</strong> ${Number(driver.total_earnings || 0).toFixed(2)}</p>
              <p><strong>Rating:</strong> {avgRating(driver.id)}</p>
            </div>
          ))
        )}
      </section>

      <section className="card">
        <h2>Recent Rides</h2>
        {rides.length === 0 ? (
          <p>No rides yet.</p>
        ) : (
          rides.slice(0, 10).map((ride) => (
            <div key={ride.id} className="ride-card">
              <p><strong>Status:</strong> {ride.status}</p>
              <p><strong>Pickup:</strong> {ride.pickup_address || 'Unknown'}</p>
              <p><strong>Dropoff:</strong> {ride.destination_address || 'Unknown'}</p>
              <p><strong>Fare:</strong> {fare(ride)}</p>
            </div>
          ))
        )}
      </section>
    </div>
  )
}

export default App