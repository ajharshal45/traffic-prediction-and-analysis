import React, { useState } from "react";
import { MapContainer, TileLayer, FeatureGroup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { EditControl } from "react-leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import "./event.css";
import apiRequest from "../../lib/apiRequest";
import L from "leaflet";

const Event = () => {
  const [formData, setFormData] = useState({
    category: "",
    startTime: "",
    endTime: "",
    crowd: "",
    vehicleCount: "",
    eventPoints: [],
  });

  // Handle form inputs
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle polyline creation on map
  const handleDrawCreated = (e) => {
    const layer = e.layer;

    // If the layer supports latLngs extraction
    if (layer && typeof layer.getLatLngs === "function") {
      let latLngs = layer.getLatLngs();

      // Flatten nested polyline arrays
      if (Array.isArray(latLngs[0])) {
        latLngs = latLngs[0];
      }

      const points = latLngs.map((latlng) => ({
        lat: Number(latlng.lat),
        lng: Number(latlng.lng),
      }));

      setFormData((prev) => ({
        ...prev,
        eventPoints: points,
      }));

      console.log("Polyline Points:", points);
    } else {
      alert("Please draw ONLY a polyline.");
    }
  };

  // Submit form data
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        ...formData,
        crowd: Number(formData.crowd),
        vehicleCount: Number(formData.vehicleCount),
        eventPoints: formData.eventPoints.map((p) => ({
          lat: Number(p.lat),
          lng: Number(p.lng),
        })),
      };

      const response = await apiRequest.post("/event/", payload);
      alert(response.data.message || "Event created successfully!");
    } catch (error) {
      alert(
        "Error creating event: " +
        (error.response?.data?.message || error.message)
      );
    }
  };

  return (
    <div className="event-container">

      {/* Map Section */}
      <div className="event-map-container">
        <MapContainer
          center={[18.5204, 73.8567]}
          zoom={13}
          className="event-map"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          <FeatureGroup>
            <EditControl
              position="topleft"
              onCreated={handleDrawCreated}
              draw={{
                polyline: true,
                polygon: false,
                rectangle: false,
                circle: false,
                circlemarker: false,
                marker: false,
              }}
            />
          </FeatureGroup>

        </MapContainer>
      </div>

      {/* Form Section */}
      <div className="event-form-container">
        <h1>Create Event</h1>

        <form onSubmit={handleSubmit} className="event-form">

          <div className="form-group">
            <label>Category:</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            >
              <option value="" disabled>Select event category</option>
              <option value="Rally">Rally</option>
              <option value="Procession">Procession</option>
              <option value="Function">Function</option>
            </select>
          </div>

          <div className="form-group">
            <label>Start Time:</label>
            <input
              type="datetime-local"
              name="startTime"
              value={formData.startTime}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>End Time:</label>
            <input
              type="datetime-local"
              name="endTime"
              value={formData.endTime}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Crowd Size:</label>
            <input
              type="number"
              name="crowd"
              value={formData.crowd}
              onChange={handleChange}
              required
              placeholder="Enter estimated crowd size"
            />
          </div>

          <div className="form-group">
            <label>Vehicle Count:</label>
            <input
              type="number"
              name="vehicleCount"
              value={formData.vehicleCount}
              onChange={handleChange}
              required
              placeholder="Enter estimated vehicle count"
            />
          </div>

          {/* Editable Event Points */}
          <div className="form-group">
            <label>Event Points (lat,lng):</label>
            <textarea
              rows="6"
              placeholder="Example:
              18.5204, 73.8567
              18.5220, 73.8590"
              value={formData.eventPoints
                .map((p) => `${p.lat}, ${p.lng}`)
                .join("\n")}
              onChange={(e) => {
                const lines = e.target.value
                  .split("\n")
                  .map((l) => l.trim())
                  .filter((l) => l !== "");

                const typedPoints = lines
                  .map((line) => line.split(","))
                  .map(([lat, lng]) => ({
                    lat: Number(lat),
                    lng: Number(lng),
                  }))
                  .filter((p) => !isNaN(p.lat) && !isNaN(p.lng));

                setFormData((prev) => ({
                  ...prev,
                  eventPoints: typedPoints,
                }));
              }}
            ></textarea>
          </div>

          <button type="submit" className="submit-btn">
            Create Event
          </button>
        </form>
      </div>

    </div>
  );
};

export default Event;