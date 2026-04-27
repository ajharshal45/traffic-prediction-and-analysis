import React, { useEffect, useState } from 'react';
import './potholeDisplay.css';
import PotholeCard from '../../components/potholeCard/potholeCard';
import apiRequest from "../../lib/apiRequest";

const PotholeDisplay = () => {
  const [potholes, setPotholes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState('');

  const fetchPotholes = async () => {
    try {
      const response = await apiRequest.get("/model/getPotholeData");
      const data = response.data;

      // Fetch the place names for each pothole
      const potholesWithPlaceNames = await Promise.all(
        data.map(async (pothole) => {
          const placeName = await getPlaceName(pothole.latitude, pothole.longitude);
          return { ...pothole, placeName };
        })
      );
    

      setPotholes(potholesWithPlaceNames);
    } catch (error) {
      console.error("Error fetching potholes:", error);
    }
  };

  const getPlaceName = async (latitude, longitude) => {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`;
  
    try {
      const response = await fetch(url);
      const data = await response.json();
  
      const { neighbourhood, village, city, postcode ,road} = data.address;
      let placeDetails = '';
  
      // Create a string with the relevant place details if they exist
      if (neighbourhood) placeDetails += `${neighbourhood}, `;
      if (village) placeDetails += `${village}, `;
      if (road) placeDetails+=`${road}, `;
      if (city) placeDetails += `${city}, `;
      if (postcode) placeDetails += `${postcode}`;
  
      // Remove the trailing comma and space if present
      placeDetails = placeDetails.trim().replace(/,\s*$/, '');
  
      return placeDetails || 'Unknown location';
    } catch (error) {
      console.error('Error fetching place name:', error);
      return 'Unknown location';
    }
  };

  useEffect(() => {
    fetchPotholes();
  }, []);

  const handleResolved = async (id) => {
    try {
      await apiRequest.put(`/model/${id}/resolve`);
      setPotholes(prev => prev.filter(p => p._id !== id));
      setToast('Resolved!');
      setTimeout(() => setToast(''), 2000);
    } catch (error) {
      console.error('Error resolving pothole:', error);
    }
  };

  // Filter users based on search term
  const filteredPotholes = potholes.filter(pothole => 
    pothole.placeName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pothole-display">
    {toast && (
      <div style={{
        position: 'fixed', top: '20px', right: '20px', background: '#22c55e',
        color: '#fff', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold',
        zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
      }}>{toast}</div>
    )}
    <input
        type="text"
        placeholder="Search Potholes by location...."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-bar"
      />
      {filteredPotholes.length > 0 ? (
        <div className="pothole-grid">
          {filteredPotholes.map((pothole) => (
            <PotholeCard
              key={pothole._id}
              imageSrc={pothole.src}
              longitude={pothole.longitude}
              latitude={pothole.latitude}
              placeName={pothole.placeName}
              onResolved={() => handleResolved(pothole._id)}
            />
          ))}
        </div>
      ) : (
        <p>No potholes found.</p>
      )}
    </div>
  );
};

export default PotholeDisplay;
