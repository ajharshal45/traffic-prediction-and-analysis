# Execution Steps for Traffic Prediction and Analysis System

This document outlines the steps required to execute the Traffic Prediction and Analysis System locally.

## Prerequisites

1.  **Node.js**: Ensure Node.js (v18 or higher) is installed.
2.  **Python**: Ensure Python (v3.8 or higher) is installed.
3.  **MongoDB**: Ensure MongoDB is running or you have a valid MongoDB URI.

## 1. Backend Setup (Node.js)

The main backend handles API requests, authentication, and database interactions.

1.  Open a terminal and navigate to the backend directory:
    ```bash
    cd road-traffic-backend-main
    ```
2.  Install the required Node.js dependencies:
    ```bash
    npm install
    ```
3.  Set up the environment variables:
    *   Create a `.env` file in the `road-traffic-backend-main` directory.
    *   Add your MongoDB connection string and other required variables:
        ```env
        PORT=4000
        MONGODB_URI=your_mongodb_connection_string
        JWT_SECRET=your_jwt_secret
        ```
4.  Start the Node.js backend server:
    ```bash
    npm start
    ```
    The backend server will run on `http://localhost:4000` (or the port specified in `.env`).

## 2. Pothole Detection Model Setup (Python/Flask)

The pothole detection service runs as a separate Python Flask application.

1.  Open a new terminal and navigate to the pothole model directory:
    ```bash
    cd road-traffic-backend-main/pothole-model
    ```
2.  Install the required Python dependencies:
    ```bash
    pip install flask flask-cors tensorflow pillow numpy
    ```
3.  Start the Flask server:
    ```bash
    python app.py
    ```
    The pothole detection model will be accessible at `http://localhost:3003`.

## 3. Frontend Setup (React/Vite)

The frontend provides the user interface for the system.

1.  Open a new terminal and navigate to the frontend directory:
    ```bash
    cd road-traffic-frontend-main
    ```
2.  Install the required Node.js dependencies:
    ```bash
    npm install
    ```
3.  Start the Vite development server:
    ```bash
    npm run dev
    ```
4.  Open your web browser and navigate to the URL provided by Vite (typically `http://localhost:5173`).

## Summary of Running Services
*   **Frontend**: `http://localhost:5173`
*   **Main Backend API**: `http://localhost:4000`
*   **Pothole Detection API**: `http://localhost:3003`

You can now use the application from the frontend interface!
