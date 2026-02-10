import React from 'react'
import './adminDashboard.css'

const AdminDashboard = () => {
  return (
    <div className='btn-container'>
        <a href="/admin/analytics" className="btn btn-analytics">Traffic Analytics</a>
        <a href="/admin/potholes" className="btn">View Potholes</a>
        <a href="/admin/complaints" className="btn">View Complaints</a>
        <a href="/admin/users" className="btn">Grant Admin role</a>
    </div>
  )
}

export default AdminDashboard;