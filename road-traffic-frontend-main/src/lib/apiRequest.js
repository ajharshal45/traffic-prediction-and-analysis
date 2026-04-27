import axios from 'axios';

// CRITICAL FIX: Use the VITE environment variable (Vite automatically exposes 
// variables prefixed with VITE_ to the client at build time).
// We include a fallback to the localhost URL for pure development environments 
// where the .env file might not be perfectly configured yet.
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8080/api"; 

const apiRequest = axios.create({
    baseURL: baseURL, 
    withCredentials: true, // Crucial for sending/receiving HTTP-only cookies (JWT)
});

export default apiRequest;