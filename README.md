# Traffic Prediction and Analysis System

## Overview
The Traffic Prediction and Analysis System is a comprehensive software solution designed to monitor, forecast, and manage urban traffic conditions. The primary objective of this project is to provide a user-friendly and highly efficient platform that offers real-time traffic insights, hazard detection, and predictive analytics. By merging modern web technologies with machine learning, the system helps administrators and commuters navigate roads safer and smarter.

## Key Features
- **Real-Time Traffic Monitoring**: Displays live traffic congestion levels using integrated maps and interactive dashboards.
- **Traffic Prediction Engine**: Analyzes historical traffic data to provide accurate future congestion forecasts, helping users plan routes in advance.
- **Pothole and Hazard Detection**: Employs an intelligent image-processing machine learning model to automatically detect potholes and road irregularities from uploaded images, issuing automated alerts.
- **Route Comparison and Navigation**: Recommends the optimal and most efficient routes based on distance, estimated time, and predicted traffic flow.
- **Comprehensive Administration Panel**: Allows authorized users to oversee reports, manage system events, and visualize deep analytics through charts and graphs.
- **Complaint Management System**: Provides a seamless interface for citizens to report infrastructure issues, including road damage and faulty traffic signals.

## System Architecture

The architecture of this project is decoupled into three primary components to ensure high performance and scalability:

### 1. Frontend Application (`road-traffic-frontend-main`)
The client-side interface is developed using modern web development frameworks.
- **Framework**: React.js with Vite for fast build and rendering speeds.
- **Mapping & Visualization**: Integration with Leaflet and Chart.js for rendering dynamic maps and analytical charts.
- **Responsibilities**: It provides the Graphical User Interface (GUI) for users to interact with traffic maps, submit complaints, and view route options. It communicates securely with the backend via RESTful APIs.

### 2. Main Backend API (`road-traffic-backend-main`)
The core server handles all business logic, data persistence, and routing.
- **Technology Stack**: Node.js and Express.js.
- **Database**: MongoDB (managed via Mongoose) is used to store user profiles, traffic history, prediction logs, and submitted complaints.
- **Responsibilities**: It acts as the central hub, processing frontend requests, running scheduled data collection jobs, authenticating users securely using JWT, and serving as a bridge to the Machine Learning microservice.

### 3. Pothole Detection Model (`road-traffic-backend-main/pothole-model`)
A standalone Python microservice dedicated to image classification and computer vision tasks.
- **Technology Stack**: Python, Flask, TensorFlow, and Keras.
- **Model**: Utilizes a MobileNet-based convolutional neural network (CNN) fine-tuned for recognizing road surface damages.
- **Responsibilities**: Receives image payloads via an exposed API endpoint, pre-processes the image, executes the model prediction, and returns a confidence score indicating the presence of a pothole.

## Installation and Execution
Detailed setup instructions, including prerequisite installations and steps to run all three services concurrently on a local environment, are thoroughly documented in the included PDF manual. 

Please refer to **`Execution_Steps.pdf`** located at the root of this repository to start the application.

## Contributors
This project was conceptualized, developed, and submitted by the following team members:
- Pranav Jagtap
- Shreyash Jobanputra
- Suyash Jobanputra
- Harshal Jaiswal
