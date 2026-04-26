# Software Requirements Specification (SRS)

## Traffic Analysis & Prediction System — Government of Pune

---

**Document Version:** 1.0  
**Date:** 23 February 2026  
**Prepared By:** Akash Bhandari, Ajinkya Walunj  
**Project Title:** Road Traffic Analysis and Prediction System  
**Client:** Government of Pune  

---

## Table of Contents

1. [Introduction](#1-introduction)  
   1.1 [Purpose](#11-purpose)  
   1.2 [Scope](#12-scope)  
   1.3 [Definitions, Acronyms, and Abbreviations](#13-definitions-acronyms-and-abbreviations)  
   1.4 [References](#14-references)  
   1.5 [Overview](#15-overview)  
2. [Overall Description](#2-overall-description)  
   2.1 [Product Perspective](#21-product-perspective)  
   2.2 [Product Functions](#22-product-functions)  
   2.3 [User Classes and Characteristics](#23-user-classes-and-characteristics)  
   2.4 [Operating Environment](#24-operating-environment)  
   2.5 [Design and Implementation Constraints](#25-design-and-implementation-constraints)  
   2.6 [Assumptions and Dependencies](#26-assumptions-and-dependencies)  
3. [System Architecture](#3-system-architecture)  
   3.1 [High-Level Architecture Diagram](#31-high-level-architecture-diagram)  
   3.2 [Technology Stack](#32-technology-stack)  
4. [Specific Requirements](#4-specific-requirements)  
   4.1 [Functional Requirements](#41-functional-requirements)  
   4.2 [Non-Functional Requirements](#42-non-functional-requirements)  
   4.3 [External Interface Requirements](#43-external-interface-requirements)  
5. [Data Requirements](#5-data-requirements)  
   5.1 [Database Schema Overview](#51-database-schema-overview)  
   5.2 [Data Dictionary](#52-data-dictionary)  
6. [System Features (Detailed)](#6-system-features-detailed)  
7. [API Specification](#7-api-specification)  
8. [Appendices](#8-appendices)

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) document provides a comprehensive description of the **Road Traffic Analysis and Prediction System** developed for the Government of Pune. It details the functional and non-functional requirements, system architecture, data models, and external interfaces of the system. This document is intended for developers, stakeholders, project evaluators, and maintenance teams.

### 1.2 Scope

The system is a full-stack web application designed to:

- **Predict traffic congestion** on key Pune routes using a multi-factor scoring engine incorporating historical data, weather conditions, Google Traffic data, nearby events, construction zones, and festivals.
- **Detect potholes** using a MobileNet-based deep learning model deployed as a Flask microservice.
- **Manage citizen complaints** with image uploads and geolocation tagging.
- **Track urban infrastructure** including schools, hospitals, hotels, malls, gardens, banquet halls, parking buildings, and construction projects.
- **Provide analytics dashboards** with traffic trends, heatmaps, root-cause breakdowns, route comparisons, and AI-generated recommendations.
- **Automate data collection** through a scheduled service that gathers traffic data every 2 hours for monitored routes.

The system consists of three main components:
1. **Node.js Express Backend** (Port 3001) — RESTful API server
2. **Flask ML Microservice** (Port 3003) — Pothole detection AI
3. **React + Vite Frontend** (Port 5173) — User-facing web application

### 1.3 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|------|-----------|
| **SRS** | Software Requirements Specification |
| **API** | Application Programming Interface |
| **JWT** | JSON Web Token |
| **ML** | Machine Learning |
| **RBAC** | Role-Based Access Control |
| **CORS** | Cross-Origin Resource Sharing |
| **CRUD** | Create, Read, Update, Delete |
| **REST** | Representational State Transfer |
| **PathInfo** | A data record storing traffic score, time slot, date, and route information |
| **Traffic Score** | A numerical value (0–100) representing congestion severity on a route |
| **Time Slot** | A 2-hour window (e.g., "08-10", "14-16") used for data collection and prediction |
| **Hotspot** | A known traffic congestion point with geographic coordinates |
| **Haversine Formula** | Mathematical formula to calculate distance between two GPS coordinates |

### 1.4 References

- IEEE 830-1998 Standard for Software Requirements Specifications
- MongoDB Documentation: https://www.mongodb.com/docs/
- Express.js Documentation: https://expressjs.com/
- React Documentation: https://react.dev/
- TensorFlow/Keras MobileNet: https://keras.io/api/applications/mobilenet/
- OpenWeatherMap API: https://openweathermap.org/api
- Google Maps Directions API: https://developers.google.com/maps/documentation/directions

### 1.5 Overview

The remainder of this document is organized as follows:
- **Section 2** provides an overall description of the product, user classes, and constraints.
- **Section 3** describes the system architecture and technology stack.
- **Section 4** details specific functional and non-functional requirements.
- **Section 5** covers data requirements and database models.
- **Section 6** provides detailed descriptions of each system feature.
- **Section 7** specifies the complete API endpoints.
- **Section 8** contains appendices.

---

## 2. Overall Description

### 2.1 Product Perspective

The Traffic Analysis & Prediction System is a **standalone web-based application** designed for the Government of Pune's traffic management department. It operates as a client-server system with the following context:

- The system integrates with **external APIs** (OpenWeatherMap, Google Maps Directions, Cloudinary) for enriched data.
- It collects traffic data from **5 monitored Pune routes** every 2 hours via an automated scheduler.
- Citizens interact through the frontend to report complaints, view traffic predictions, and access analytics.
- Administrators manage data, view prediction accuracy, and oversee citizen reports through a dedicated admin panel.

```
┌──────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                        │
│  OpenWeatherMap API │ Google Maps API │ Cloudinary │ MongoDB     │
└────────────┬────────────────┬─────────────┬────────────┬────────┘
             │                │             │            │
┌────────────▼────────────────▼─────────────▼────────────▼────────┐
│                    NODE.JS EXPRESS BACKEND (Port 3001)           │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────────┐      │
│  │   Auth   │ │ Predict   │ │Analytics │ │  Facilities  │      │
│  │Controller│ │ Traffic   │ │Controller│ │  Controllers │      │
│  └──────────┘ │ Controller│ └──────────┘ └──────────────┘      │
│               └───────────┘                                     │
│  ┌────────────────────────────────────────────────────────┐     │
│  │           Data Collector + Scheduler Service           │     │
│  └────────────────────────────────────────────────────────┘     │
└─────────────────────────┬───────────────────────────────────────┘
                          │ REST API
┌─────────────────────────▼───────────────────────────────────────┐
│              REACT + VITE FRONTEND (Port 5173)                  │
│  ┌─────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────┐     │
│  │  Maps   │ │  Traffic   │ │Analytics │ │    Admin     │     │
│  │(Leaflet)│ │ Prediction │ │ Charts   │ │  Dashboard   │     │
│  └─────────┘ └────────────┘ └──────────┘ └──────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│              FLASK ML MICROSERVICE (Port 3003)                  │
│  ┌──────────────────────────────────────────────────────┐      │
│  │         MobileNet Pothole Detection Model            │      │
│  │         (pothole_mobnet_base.h5 — 224×224 RGB)       │      │
│  └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Product Functions

The major functions of the system are:

| # | Function | Description |
|---|----------|-------------|
| F1 | **User Authentication** | Register, login, logout with JWT tokens and role-based access |
| F2 | **Traffic Prediction** | Multi-factor congestion scoring using historical data, weather, events, construction, hotspots, Google Traffic, and time-of-day multipliers |
| F3 | **Smart Time Suggestions** | Recommend optimal travel times by comparing adjacent time slots |
| F4 | **Pothole Detection** | AI-powered image classification using MobileNet deep learning model |
| F5 | **Citizen Complaints** | Submit and manage geotagged complaints with image evidence |
| F6 | **Event Management** | Track events that impact traffic patterns |
| F7 | **Infrastructure Tracking** | Manage construction, diversions, and urban facilities data |
| F8 | **Traffic Analytics** | Trends, heatmaps, root-cause breakdowns, route comparisons, and AI recommendations |
| F9 | **Automated Data Collection** | Scheduled 2-hourly traffic data collection for 5 monitored routes |
| F10 | **Prediction Accuracy Logging** | Track and verify prediction accuracy over time |
| F11 | **Admin Dashboard** | Administrative panel for managing users, complaints, potholes, and analytics |
| F12 | **Interactive Map Visualization** | Leaflet + Google Maps based route display, routing, and geosearch |
| F13 | **Festival & Calendar Analysis** | Date-specific traffic analysis incorporating festival impact |
| F14 | **Citizen Rewards (Redeem)** | Gamification system rewarding citizens for reporting issues |

### 2.3 User Classes and Characteristics

| User Class | Description | Access Level |
|------------|-------------|-------------|
| **Citizen (Regular User)** | General public who view traffic predictions, submit complaints, report potholes, and view analytics. Requires registration. | Authenticated routes |
| **Administrator** | Government officials who manage data, view prediction accuracy, review complaints/pothole reports, and manage users. | Admin-restricted routes |
| **Unauthenticated Visitor** | Can view the homepage, register, and log in. No access to features. | Public routes only |

### 2.4 Operating Environment

| Component | Requirement |
|-----------|-------------|
| **Server OS** | Any OS supporting Node.js v14+ and Python 3.8+ |
| **Client** | Modern web browser (Chrome, Firefox, Edge, Safari) |
| **Database** | MongoDB 6.0+ (local or MongoDB Atlas cloud) |
| **Runtime** | Node.js v14+, Python 3.8+ |
| **Hosting** | Render.com (production), localhost (development) |
| **Network** | Internet connection required for external API integrations |

### 2.5 Design and Implementation Constraints

1. **Technology Constraints**: The system must use Node.js with Express for the backend API and React with Vite for the frontend.
2. **Database**: MongoDB is the mandatory database; all models use Mongoose ODM.
3. **ML Model**: The pothole detection model is pre-trained (MobileNet base) and served via Flask; it is not retrained in production.
4. **API Rate Limits**: OpenWeatherMap and Google Maps APIs have rate limits that affect data freshness.
5. **Image Storage**: All user-uploaded images must be stored via Cloudinary (no local persistent storage).
6. **Authentication**: JWT tokens stored in HTTP-only cookies with 7-day expiration.
7. **Geographic Scope**: The system is designed specifically for Pune city routes.
8. **Data Collection Interval**: Traffic data is collected every 2 hours in predefined time slots.

### 2.6 Assumptions and Dependencies

**Assumptions:**
- Users have access to modern web browsers with JavaScript enabled.
- The MongoDB database server is available and accessible.
- External APIs (OpenWeatherMap, Google Maps, Cloudinary) remain available and functional.
- The 5 monitored Pune routes remain the primary focus for automated data collection.

**Dependencies:**
- **OpenWeatherMap API** — Weather data for traffic prediction scoring.
- **Google Maps Directions API** — Real-time traffic duration data and route information.
- **Cloudinary** — Cloud-based image storage for complaints and pothole reports.
- **MongoDB Atlas / Local MongoDB** — Primary data persistence layer.
- **TensorFlow/Keras** — ML model inference for pothole detection (Python).

---

## 3. System Architecture

### 3.1 High-Level Architecture Diagram

```
                    ┌─────────────────────────┐
                    │      CLIENT BROWSER      │
                    │   React 18 + Vite SPA    │
                    │   (Leaflet, Chart.js,    │
                    │    Google Maps, SASS)     │
                    └────────────┬─────────────┘
                                 │ HTTP/HTTPS (Axios)
                    ┌────────────▼─────────────┐
                    │    EXPRESS.JS API SERVER  │
                    │       (Port 3001)         │
                    │                           │
                    │  ┌─────────────────────┐  │
                    │  │    Middleware Layer  │  │
                    │  │  (CORS, JWT Auth,   │  │
                    │  │   Cookie Parser,    │  │
                    │  │   Multer Upload)    │  │
                    │  └─────────┬───────────┘  │
                    │            │               │
                    │  ┌─────────▼───────────┐  │
                    │  │   Route Handlers    │  │
                    │  │   (20 Route Files)  │  │
                    │  └─────────┬───────────┘  │
                    │            │               │
                    │  ┌─────────▼───────────┐  │
                    │  │    Controllers      │  │
                    │  │  (22 Controllers)   │  │
                    │  └─────────┬───────────┘  │
                    │            │               │
                    │  ┌─────────▼───────────┐  │
                    │  │   Mongoose Models   │  │
                    │  │   (19 Models)       │  │
                    │  └─────────┬───────────┘  │
                    │            │               │
                    │  ┌─────────▼───────────┐  │
                    │  │     Services        │  │
                    │  │  (Data Collector,   │  │
                    │  │   Scheduler,        │  │
                    │  │   Google Transit)   │  │
                    │  └─────────────────────┘  │
                    └──┬─────────┬──────────┬───┘
                       │         │          │
            ┌──────────▼──┐ ┌───▼────┐ ┌───▼──────────┐
            │   MongoDB   │ │ Flask  │ │  External    │
            │  Database   │ │  ML    │ │  APIs        │
            │(trafficana- │ │Service │ │(Weather,     │
            │  lysis)     │ │(3003)  │ │ Maps,        │
            └─────────────┘ └────────┘ │ Cloudinary)  │
                                       └──────────────┘
```

### 3.2 Technology Stack

#### Backend (Node.js Express Server)

| Category | Technology | Version |
|----------|-----------|---------|
| Runtime | Node.js | v14+ |
| Framework | Express.js | 4.21.0 |
| Database | MongoDB (Mongoose ODM) | 8.20.1 |
| Authentication | JSON Web Tokens (jsonwebtoken) | 9.0.2 |
| Password Hashing | bcryptjs | 3.0.3 |
| File Upload | Multer + Cloudinary | 1.4.5 / 1.41.3 |
| Validation | express-validator | 7.3.1 |
| HTTP Client | Axios | 1.13.2 |
| Date/Time | Luxon | 3.5.0 |
| Caching | node-cache | 5.1.2 |
| Scheduling | node-cron | 3.0.3 |
| Web Scraping | Puppeteer (+ Stealth) | 24.31.0 |
| Spreadsheet | xlsx | 0.18.5 |

#### ML Microservice (Flask)

| Category | Technology |
|----------|-----------|
| Framework | Flask |
| ML Framework | TensorFlow / Keras |
| Image Processing | Pillow, NumPy |
| Model | MobileNet Base (pothole_mobnet_base.h5) |

#### Frontend (React + Vite)

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | React | 18.3.1 |
| Build Tool | Vite | 5.4.1 |
| Routing | React Router DOM | 6.26.2 |
| HTTP Client | Axios | 1.7.7 |
| Maps | Leaflet + React-Leaflet | 1.9.4 / 4.2.1 |
| Maps (Google) | @react-google-maps/api | 2.20.3 |
| Routing (Map) | Leaflet Routing Machine | 3.2.12 |
| GeoSearch | Leaflet GeoSearch | 4.0.0 |
| Charts | Chart.js + react-chartjs-2 | 4.4.7 / 5.2.0 |
| Calendar | React Calendar | 5.1.0 |
| Rich Text Editor | React Quill | 2.0.0 |
| Styling | SASS | 1.79.4 |
| Sanitization | DOMPurify | 3.1.7 |
| Linting | ESLint | 9.9.0 |

---

## 4. Specific Requirements

### 4.1 Functional Requirements

#### FR-01: User Registration
| Field | Description |
|-------|-------------|
| **ID** | FR-01 |
| **Title** | User Registration |
| **Description** | The system shall allow new users to register by providing a username, email, and password. |
| **Input** | Username, email, password |
| **Processing** | Validate input → Hash password (bcrypt, 10 salt rounds) → Store in MongoDB |
| **Output** | Success message with user data (excluding password) |
| **Priority** | High |

#### FR-02: User Login
| Field | Description |
|-------|-------------|
| **ID** | FR-02 |
| **Title** | User Authentication (Login) |
| **Description** | The system shall authenticate users with email and password, issuing a JWT token stored in an HTTP-only cookie. |
| **Input** | Email, password |
| **Processing** | Validate credentials → Compare hashed password → Generate JWT (7-day expiry) → Set cookie |
| **Output** | JWT token in HTTP-only cookie, user profile data |
| **Priority** | High |

#### FR-03: User Logout
| Field | Description |
|-------|-------------|
| **ID** | FR-03 |
| **Title** | User Logout |
| **Description** | The system shall invalidate the user's session by clearing the JWT cookie. |
| **Priority** | High |

#### FR-04: Traffic Prediction
| Field | Description |
|-------|-------------|
| **ID** | FR-04 |
| **Title** | Multi-Factor Traffic Prediction |
| **Description** | The system shall predict traffic congestion for a given route, date, and time slot using a weighted multi-factor scoring algorithm. |
| **Input** | Source coordinates, destination coordinates, date, time slot |
| **Processing** | The prediction engine calculates a composite score (0–100) using weighted contributions from: |
| | • **Historical Data (W=25)** — Average of past PathInfo scores for matching route/time |
| | • **Construction (W=15)** — Active construction projects near the route |
| | • **Events (W=20)** — Scheduled events near the route and time |
| | • **Hotspots (W=12)** — Known congestion points along the route |
| | • **Potholes (W=8)** — Reported potholes with time-decay factor |
| | • **Complaints (W=5)** — Citizen complaints with proximity weighting |
| | • **Weather (W=15)** — Current/forecasted weather impact (Thunderstorm=40, Rain=35, etc.) |
| | • **Google Traffic** — Real-time traffic delay ratio from Google Directions API |
| | • **Time-of-Day Multiplier** — Rush hour amplification (peak multiplier: 1.8 for 08-10, 18-20) |
| | • **Nearby Facilities** — Schools, hospitals, malls, hotels, banquet halls, gardens, parking buildings |
| **Output** | Traffic score (0–100), traffic level (Low/Moderate/High/Severe), breakdown of contributing factors, root-cause summary, recommendations |
| **Priority** | Critical |

#### FR-05: Smart Time Suggestions
| Field | Description |
|-------|-------------|
| **ID** | FR-05 |
| **Title** | Optimal Travel Time Suggestions |
| **Description** | The system shall compute predictions for ±2 adjacent time slots and recommend the least congested alternatives. |
| **Input** | Source, destination, date, time slot |
| **Output** | Sorted list of time slots with predicted scores, highlighting the best time to travel |
| **Priority** | High |

#### FR-06: Pothole Detection
| Field | Description |
|-------|-------------|
| **ID** | FR-06 |
| **Title** | AI-Powered Pothole Detection |
| **Description** | The system shall accept an uploaded road image, process it through the MobileNet-based ML model, and classify it as pothole or no-pothole. |
| **Input** | Image file (JPEG/PNG), geolocation coordinates |
| **Processing** | Resize to 224×224 → Normalize → MobileNet inference → Binary classification (threshold: 0.5) |
| **Output** | Classification result (pothole/no_pothole), confidence score, stored with geolocation in database |
| **Priority** | High |

#### FR-07: Citizen Complaint Management
| Field | Description |
|-------|-------------|
| **ID** | FR-07 |
| **Title** | Complaint Submission and Tracking |
| **Description** | Authenticated citizens shall submit complaints with description, location, and optional image upload (stored via Cloudinary). |
| **Input** | Description, location, optional image |
| **Output** | Complaint record with unique ID, timestamp, and image URL |
| **Priority** | High |

#### FR-08: Event Management
| Field | Description |
|-------|-------------|
| **ID** | FR-08 |
| **Title** | Event Creation and Tracking |
| **Description** | The system shall allow creation of traffic-affecting events with name, description, location, time range, and expected impact. |
| **Priority** | Medium |

#### FR-09: Infrastructure Tracking
| Field | Description |
|-------|-------------|
| **ID** | FR-09 |
| **Title** | Urban Infrastructure Management |
| **Description** | The system shall manage data for 10 types of urban infrastructure: schools, hospitals, hotels, malls, banquet halls, gardens, parking buildings, construction projects, diversions, and metro stations. Each record includes geolocation data. |
| **Priority** | Medium |

#### FR-10: Traffic Analytics Dashboard
| Field | Description |
|-------|-------------|
| **ID** | FR-10 |
| **Title** | Analytics and Visualization |
| **Description** | The system shall provide: |
| | • **Traffic Trends** — Line charts showing score trends over N days |
| | • **Heatmap** — Time slots vs. days matrix visualization |
| | • **Root-Cause Breakdown** — Factor-by-factor contribution analysis |
| | • **Route Comparison** — Comparative performance across all routes |
| | • **AI Recommendations** — Generated improvement suggestions |
| **Priority** | High |

#### FR-11: Automated Data Collection
| Field | Description |
|-------|-------------|
| **ID** | FR-11 |
| **Title** | Scheduled Traffic Data Collection |
| **Description** | The system shall automatically collect traffic data for 5 monitored Pune routes every 2 hours using node-cron. Data includes generated traffic scores, breakdowns, and time-slot information. |
| **Monitored Routes** | Hinjewadi–Swargate, Hadapsar–Shivajinagar, Kothrud–Shivajinagar, Swargate–Katraj, (+ 1 more) |
| **Priority** | High |

#### FR-12: Prediction Accuracy Logging
| Field | Description |
|-------|-------------|
| **ID** | FR-12 |
| **Title** | Prediction Verification and Accuracy Tracking |
| **Description** | The system shall log each prediction with predicted score, and later backfill actual scores to calculate accuracy. Admin users can view prediction accuracy trends. |
| **Priority** | Medium |

#### FR-13: Admin Dashboard
| Field | Description |
|-------|-------------|
| **ID** | FR-13 |
| **Title** | Administrative Management Panel |
| **Description** | Admin users shall access a dedicated dashboard to: view all pothole reports, manage complaints, manage users (promote to admin), view analytics, and view prediction accuracy. |
| **Routes** | `/admin`, `/admin/analytics`, `/admin/predictions`, `/admin/potholes`, `/admin/complaints`, `/admin/users` |
| **Priority** | High |

#### FR-14: Interactive Map Visualization
| Field | Description |
|-------|-------------|
| **ID** | FR-14 |
| **Title** | Map-Based Route Visualization |
| **Description** | The system shall display interactive maps using Leaflet with route visualization, location search (GeoSearch), and routing capabilities (Leaflet Routing Machine). Google Maps integration is also available. |
| **Priority** | High |

#### FR-15: Festival and Calendar Analysis
| Field | Description |
|-------|-------------|
| **ID** | FR-15 |
| **Title** | Date-Specific Traffic Analysis |
| **Description** | The system shall provide traffic score analysis based on specific dates, festivals, and last-four-week weekday trends. |
| **Priority** | Medium |

#### FR-16: Nearby Facility Detection
| Field | Description |
|-------|-------------|
| **ID** | FR-16 |
| **Title** | Nearby Points of Interest |
| **Description** | Given a route's coordinates, the system shall find nearby schools, hospitals, traffic hotspots, and other facilities within a configurable proximity radius (default: 200m) using the Haversine formula. |
| **Priority** | Medium |

#### FR-17: Traffic Status Updates
| Field | Description |
|-------|-------------|
| **ID** | FR-17 |
| **Title** | Real-Time Traffic Status |
| **Description** | The system shall allow posting and viewing real-time traffic status updates for Pune roads. |
| **Priority** | Medium |

#### FR-18: Citizen Rewards System
| Field | Description |
|-------|-------------|
| **ID** | FR-18 |
| **Title** | Gamification and Redemption |
| **Description** | Citizens shall earn points (citizen score) for reporting issues. Points can be viewed on a redemption/rewards page. |
| **Priority** | Low |

---

### 4.2 Non-Functional Requirements

#### NFR-01: Performance
| Requirement | Target |
|-------------|--------|
| API response time (typical) | < 500ms |
| Traffic prediction response | < 3 seconds (includes external API calls) |
| Pothole detection inference | < 5 seconds per image |
| Concurrent users supported | At least 100 simultaneous users |
| Weather data cache duration | 15 minutes |

#### NFR-02: Security
| Requirement | Description |
|-------------|-------------|
| Password Storage | bcrypt hashing with 10 salt rounds |
| Authentication | JWT tokens in HTTP-only cookies (7-day expiry) |
| Authorization | Role-based access control (User / Admin) |
| Input Validation | express-validator on all API endpoints |
| Content Sanitization | DOMPurify on frontend for user-generated content |
| CORS | Restricted to whitelisted origins only |

#### NFR-03: Reliability
| Requirement | Description |
|-------------|-------------|
| Data Collection | Automated scheduler runs every 2 hours with error handling |
| Database | MongoDB connection retry on failure |
| External API Fallback | Graceful degradation when weather/maps APIs are unavailable |

#### NFR-04: Scalability
| Requirement | Description |
|-------------|-------------|
| Horizontal Scaling | Stateless API design enables multiple server instances |
| Database Indexing | Mongoose schemas support efficient queries on date, route, and time fields |
| Caching | node-cache for frequently accessed data (weather, predictions) |

#### NFR-05: Usability
| Requirement | Description |
|-------------|-------------|
| Responsive Design | Application accessible on desktop and mobile browsers |
| Map Interaction | Intuitive map-based route selection and visualization |
| Data Visualization | Charts and heatmaps for quick traffic pattern comprehension |

#### NFR-06: Maintainability
| Requirement | Description |
|-------------|-------------|
| Code Organization | Modular MVC pattern (Models, Controllers, Routes) |
| Module System | ES Modules throughout (type: "module" in package.json) |
| Environment Config | All secrets stored in `.env` files, never hardcoded |

---

### 4.3 External Interface Requirements

#### 4.3.1 User Interfaces
- **Home Page** — Landing page with project overview and navigation
- **Login / Register** — Authentication forms
- **Traffic Prediction** — Map-based route input with date/time selection
- **Analysis Page** — Charts and analytics dashboards
- **Complaint Form** — Description, location, and image upload
- **Pothole Report** — Image capture/upload with geotagging
- **Admin Panel** — Tabular data views for management tasks
- **Calendar View** — Date-based traffic visualization
- **Route History** — Historical traffic data for specific routes

#### 4.3.2 Hardware Interfaces
- No dedicated hardware interfaces required.
- Standard web server hardware with internet connectivity.

#### 4.3.3 Software Interfaces

| External System | Interface Type | Purpose |
|----------------|---------------|---------|
| **OpenWeatherMap API** | REST API (HTTPS) | Fetch current weather and 5-day forecasts for Pune |
| **Google Maps Directions API** | REST API (HTTPS) | Get real-time traffic-aware route durations |
| **Cloudinary** | SDK / REST API | Upload and serve user-submitted images |
| **MongoDB** | Mongoose ODM (TCP) | Primary data storage (database: `trafficanalysis`) |

#### 4.3.4 Communication Interfaces
- **Protocol**: HTTP/HTTPS
- **Data Format**: JSON (REST API requests and responses)
- **File Upload**: multipart/form-data (Multer)
- **Authentication**: JWT Bearer tokens in HTTP-only cookies

---

## 5. Data Requirements

### 5.1 Database Schema Overview

The system uses **MongoDB** with the database name `trafficanalysis`. There are **19 collections** managed through Mongoose models:

```
trafficanalysis (Database)
│
├── users                  — User accounts with roles
├── pathinfos              — Historical traffic data records
├── predictionlogs         — Prediction accuracy tracking
├── complaints             — Citizen complaints
├── images                 — Pothole detection results
├── events                 — Traffic-affecting events
├── bms_events             — BookMyShow events data
├── constructions          — Active construction projects
├── diversions             — Traffic diversions
├── schools                — Educational institutions
├── hospitals              — Healthcare facilities
├── hotels                 — Hospitality venues
├── malls                  — Shopping centers
├── banquethalls           — Event venues
├── gardens                — Public parks and gardens
├── parkingbuildings       — Parking facilities
├── trafficstatuses        — Real-time traffic updates
├── hotspotlocations       — Known congestion points
└── metrostations          — Metro station data
```

### 5.2 Data Dictionary

#### Users Collection
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| username | String | Yes | Unique username |
| email | String | Yes | Unique email address |
| password | String | Yes | bcrypt-hashed password |
| isAdmin | Boolean | No | Admin role flag (default: false) |
| createdAt | Date | Auto | Account creation timestamp |
| updatedAt | Date | Auto | Last update timestamp |

#### PathInfo Collection (Traffic Records)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| pathId | String | Yes | Route identifier (e.g., "Hinjewadi-Swargate") |
| date | Date | Yes | Date of the traffic record |
| timeSlot | String | Yes | 2-hour window (e.g., "08-10") |
| score | Number | Yes | Traffic congestion score (0–100) |
| source | Object | No | Source location coordinates |
| destination | Object | No | Destination location coordinates |
| routePoints | Array | No | Array of coordinate objects along the route |
| trafficLevel | String | No | Derived level (Low/Moderate/High/Severe) |
| breakdown | Object | No | Factor-by-factor contribution breakdown |

#### PredictionLog Collection
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| pathId | String | Yes | Route identifier |
| date | Date | Yes | Prediction date |
| timeSlot | String | Yes | Time slot |
| predictedScore | Number | Yes | Predicted traffic score |
| actualScore | Number | No | Actual observed score (filled during backfill) |
| accuracy | Number | No | Calculated accuracy percentage |
| verified | Boolean | No | Whether actual data has been backfilled |

#### Complaint Collection
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| description | String | Yes | Complaint details |
| location | Object | Yes | Geolocation coordinates |
| imageUrl | String | No | Cloudinary URL for uploaded image |
| userId | ObjectId | Yes | Reference to reporting user |
| createdAt | Date | Auto | Submission timestamp |

#### Event Collection
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | String | Yes | Event name |
| description | String | No | Event details |
| location | Object | Yes | Event coordinates |
| startTime | Date | Yes | Event start date/time |
| endTime | Date | Yes | Event end date/time |
| expectedImpact | String | No | Estimated traffic impact |

#### Construction Collection
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | String | Yes | Project name |
| location | Object | Yes | Construction site coordinates |
| startDate | Date | Yes | Project start date |
| endDate | Date | No | Expected completion date |
| impact | String | No | Traffic impact level |

#### Facility Collections (Schools, Hospitals, Hotels, Malls, Gardens, BanquetHalls, ParkingBuildings)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | String | Yes | Facility name |
| latitude | Number | Yes | GPS latitude |
| longitude | Number | Yes | GPS longitude |
| address | String | No | Physical address |
| timing | String | No | Operating hours (for schools) |

---

## 6. System Features (Detailed)

### 6.1 Traffic Prediction Engine

**Description:** The core prediction engine uses a **weighted multi-factor scoring algorithm** to estimate traffic congestion on a scale of 0 to 100.

**Algorithm Overview:**

```
Final Score = Σ (Factor_Score × Weight) × Time_Multiplier

Where factors and weights are:
  Historical Average   : W = 25
  Weather Impact       : W = 15
  Construction Zones   : W = 15
  Events               : W = 20
  Hotspots             : W = 12
  Potholes (decayed)   : W = 8
  Complaints           : W = 5
  Google Traffic Ratio  : Applied as overlay
  Nearby Facilities    : Additional scoring
```

**Time-of-Day Multipliers:**
| Time Slot | Multiplier | Category |
|-----------|-----------|----------|
| 08-10 | 1.8 | Morning Rush |
| 18-20 | 1.8 | Evening Rush |
| 10-12 | 1.3 | Late Morning |
| 12-14 | 1.5 | Afternoon Peak |
| 14-16 | 1.2 | Afternoon |
| 16-18 | 1.6 | Pre-Rush |
| 06-08 | 1.4 | Early Morning |
| 20-22 | 1.1 | Night |
| 22-24 | 0.7 | Late Night |
| 00-06 | 0.5 | Off-Peak |

**Weather Impact Scores:**
| Condition | Score Addition |
|-----------|---------------|
| Thunderstorm | +40 |
| Rain | +35 |
| Snow | +30 |
| Fog | +25 |
| Drizzle | +20 |
| Mist | +15 |
| Haze | +10 |
| Clouds | +5 |
| Clear | 0 |

**Traffic Level Classification:**
| Score Range | Level |
|-------------|-------|
| 0–25 | Low |
| 26–50 | Moderate |
| 51–75 | High |
| 76–100 | Severe |

### 6.2 Automated Data Collection Service

The scheduler service uses **node-cron** to run data collection every 2 hours. It:

1. Iterates over 5 predefined Pune routes (Hinjewadi-Swargate, Hadapsar-Shivajinagar, Kothrud-Shivajinagar, Swargate-Katraj, etc.)
2. Generates realistic traffic scores based on time patterns and routes
3. Creates detailed breakdowns of contributing factors
4. Stores records in the `PathInfo` collection
5. Backfills prediction logs with actual scores for accuracy tracking

### 6.3 Pothole Detection ML Pipeline

```
Image Upload → Multer → Cloudinary Storage
                ↓
         Flask ML Service (Port 3003)
                ↓
    Preprocessing: Resize to 224×224, Normalize
                ↓
    MobileNet Inference → Binary Classification
                ↓
    Result: "pothole" (≥0.5) or "no_pothole" (<0.5)
                ↓
    Store result + geolocation in Images collection
```

---

## 7. API Specification

### 7.1 Authentication APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|:---:|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login and receive JWT | No |
| POST | `/api/auth/logout` | Clear JWT cookie | Yes |

### 7.2 Traffic Prediction APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|:---:|
| GET | `/api/path-info/predictTraffic` | Predict traffic for route/date/time | Yes |
| GET | `/api/path-info/getTimeSuggestions` | Get optimal time suggestions | Yes |
| POST | `/api/path-info` | Add traffic path data | Yes |
| GET | `/api/path-info/getCalendarData` | Calendar-based traffic data | Yes |
| GET | `/api/path-info/getFestivalData` | Festival traffic analysis | Yes |
| GET | `/api/path-info/getLastFourWeek` | Last 4 weeks weekday trends | Yes |

### 7.3 Analytics APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|:---:|
| GET | `/api/analytics/trends` | Traffic trend data | Yes |
| GET | `/api/analytics/heatmap` | Heatmap visualization data | Yes |
| GET | `/api/analytics/timeslots` | Time slots for a date | Yes |
| GET | `/api/analytics/breakdown` | Root-cause breakdown | Yes |
| GET | `/api/analytics/recommendations` | AI recommendations | Yes |
| GET | `/api/analytics/comparison` | Route comparison | Yes |
| GET | `/api/analytics/routes` | Available routes list | Yes |

### 7.4 Complaint & Pothole APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|:---:|
| POST | `/api/complaint` | Submit complaint (with image) | Yes |
| GET | `/api/complaint/getComplaintData` | Get all complaints | Yes |
| POST | `/api/model` | Upload image for pothole detection | Yes |
| GET | `/api/model/getPotholeData` | Get pothole results | Yes |

### 7.5 Event & Infrastructure APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|:---:|
| POST | `/api/event` | Create event | Yes |
| GET | `/api/event/getEventData` | Get all events | Yes |
| POST | `/api/construction` | Add construction project | Yes |
| GET | `/api/construction/getAllConstructionProjects` | List construction projects | Yes |
| POST | `/api/diversion` | Add traffic diversion | Yes |
| GET | `/api/diversion/getAllDiversions` | List diversions | Yes |

### 7.6 Facilities APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|:---:|
| POST/GET | `/api/school` | Manage schools | Yes |
| POST/GET | `/api/hospital` | Manage hospitals | Yes |
| POST/GET | `/api/hotel` | Manage hotels | Yes |
| POST/GET | `/api/mall` | Manage malls | Yes |
| POST/GET | `/api/banquethall` | Manage banquet halls | Yes |
| POST/GET | `/api/garden` | Manage gardens | Yes |
| POST/GET | `/api/parkingbuilding` | Manage parking buildings | Yes |

### 7.7 Location & Status APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|:---:|
| POST | `/api/nearby/schools` | Nearby schools for route | Yes |
| POST | `/api/nearby/hotspots` | Nearby traffic hotspots | Yes |
| GET | `/api/nearby/spots` | All traffic hotspots | Yes |
| POST | `/api/traffic-status` | Add traffic status | Yes |
| GET | `/api/traffic-status/getTrafficStatus` | Get status updates | Yes |

### 7.8 User & Prediction Log APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|:---:|
| GET | `/api/user` | Get user profile | Yes |
| PUT | `/api/user/:id/make-admin` | Promote user to admin | Yes (Admin) |
| GET | `/api/prediction-logs/*` | Prediction accuracy data | Yes (Admin) |

---

## 8. Appendices

### Appendix A: Monitored Pune Routes

| # | Route ID | Route Name | Key Waypoints |
|---|----------|------------|---------------|
| 1 | Hinjewadi-Swargate | Hinjewadi to Swargate | Hinjewadi → Bavdhan → Kothrud → Deccan → Swargate |
| 2 | Hadapsar-Shivajinagar | Hadapsar to Shivajinagar | Hadapsar → Magarpatta → Camp → Shivajinagar |
| 3 | Kothrud-Shivajinagar | Kothrud to Shivajinagar | Kothrud Depot → Deccan → Shivajinagar |
| 4 | Swargate-Katraj | Swargate to Katraj | Swargate → Market Yard → Bibwewadi → Katraj |

### Appendix B: Frontend Route Map

| Path | Component | Access |
|------|-----------|--------|
| `/` | HomePage | Public |
| `/login` | Login | Public |
| `/register` | Register | Public |
| `/pothole` | Pothole | Authenticated |
| `/complaint` | Complaint | Authenticated |
| `/analysis` | Analysis | Authenticated |
| `/redeem` | Redeem | Authenticated |
| `/event` | Event | Authenticated |
| `/route-history` | RouteHistory | Authenticated |
| `/predictive-analysis` | TrafficPrediction | Authenticated |
| `/traffic-calendar` | CalendarApp | Authenticated |
| `/festival-analysis` | LineScoreDate | Authenticated |
| `/last-four-week` | LineWeekDay | Authenticated |
| `/traffic-status` | TrafficStatus | Authenticated |
| `/admin` | AdminDashboard | Admin Only |
| `/admin/analytics` | AdminAnalytics | Admin Only |
| `/admin/predictions` | AdminPredictions | Admin Only |
| `/admin/potholes` | PotholeDisplay | Admin Only |
| `/admin/complaints` | ComplaintDisplay | Admin Only |
| `/admin/users` | UserDisplay | Admin Only |

### Appendix C: Environment Variables

| Variable | Description | Required |
|----------|-------------|:---:|
| `PORT` | Express server port (default: 3001) | Yes |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `JWT_SECRET_KEY` | Secret key for JWT signing | Yes |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account name | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Yes |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key | Yes |

---

*End of SRS Document*
