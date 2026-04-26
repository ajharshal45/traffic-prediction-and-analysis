"""
Generate SRS — IEEE 830 Template Format
CA Firm Attendance and Article Management System — Group E-17
Sponsor: SPCM (CA Firm)
"""
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import nsdecls
from docx.oxml import parse_xml
import os

doc = Document()
style = doc.styles['Normal']; style.font.name = 'Times New Roman'; style.font.size = Pt(11)
style.paragraph_format.space_after = Pt(6)
for lv in range(1,4):
    hs = doc.styles[f'Heading {lv}']; hs.font.name = 'Times New Roman'; hs.font.color.rgb = RGBColor(0,0,0)

def shade(cell, color):
    cell._tc.get_or_add_tcPr().append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color}"/>'))

def add_tbl(doc, headers, rows):
    t = doc.add_table(rows=1+len(rows), cols=len(headers)); t.style = 'Table Grid'; t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i,h in enumerate(headers):
        c = t.rows[0].cells[i]; c.text = h
        for p in c.paragraphs:
            for r in p.runs: r.bold=True; r.font.size=Pt(10)
        shade(c,"D9E2F3")
    for ri,row in enumerate(rows):
        for ci,val in enumerate(row):
            c = t.rows[ri+1].cells[ci]; c.text = str(val)
            for p in c.paragraphs:
                for r in p.runs: r.font.size=Pt(10)
    return t

def bp(doc, items):
    for item in items: doc.add_paragraph(item, style='List Bullet')

def add_feature(doc, num, name, priority, description, stimuli, reqs):
    doc.add_heading(f"4.{num} {name}", level=2)
    doc.add_heading(f"4.{num}.1 Description and Priority", level=3)
    p = doc.add_paragraph(); r = p.add_run(f"Priority: {priority}"); r.bold = True
    doc.add_paragraph(description)
    doc.add_heading(f"4.{num}.2 Stimulus/Response Sequences", level=3)
    for s in stimuli: doc.add_paragraph(s, style='List Bullet')
    doc.add_heading(f"4.{num}.3 Functional Requirements", level=3)
    for rid, req in reqs:
        p = doc.add_paragraph(); r = p.add_run(f"{rid}: "); r.bold = True; p.add_run(req)

# ====================== TITLE PAGE ======================
for _ in range(5): doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Software Requirements\nSpecification"); r.bold = True; r.font.size = Pt(28)
doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("for"); r.font.size = Pt(16)
doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("CA Firm Attendance and\nArticle Management System"); r.bold = True; r.font.size = Pt(22)
doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Version 1.0 approved"); r.font.size = Pt(14)
doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Prepared by\nNivesh Jain, Harsh Nayak, Rachit Ingole, Hasan Rupawalla\n(Group E-17)"); r.font.size = Pt(12)
doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Vishwakarma Institute of Technology, Pune\nDepartment of Computer Engineering"); r.font.size = Pt(12)
doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("March 2, 2026"); r.font.size = Pt(12)
doc.add_page_break()

# ====================== TOC + REVISION ======================
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Software Requirements Specification for CA Firm Attendance and Article Management System"); r.italic=True; r.font.size=Pt(10)
doc.add_paragraph()
doc.add_heading("Table of Contents", level=1)
toc = [
    "Revision History",
    "1.  Introduction", "    1.1  Purpose", "    1.2  Document Conventions",
    "    1.3  Intended Audience and Reading Suggestions", "    1.4  Product Scope", "    1.5  References",
    "2.  Overall Description", "    2.1  Product Perspective", "    2.2  Product Functions",
    "    2.3  User Classes and Characteristics", "    2.4  Operating Environment",
    "    2.5  Design and Implementation Constraints", "    2.6  User Documentation",
    "    2.7  Assumptions and Dependencies",
    "3.  External Interface Requirements", "    3.1  User Interfaces", "    3.2  Hardware Interfaces",
    "    3.3  Software Interfaces", "    3.4  Communications Interfaces",
    "4.  System Features",
    "    4.1  User Authentication and Session Management",
    "    4.2  Article Trainee Management",
    "    4.3  Attendance Management (Biometric/Face + GPS)",
    "    4.4  Task Assignment and Management",
    "    4.5  Progress Tracking and Monitoring",
    "    4.6  Leave Management",
    "    4.7  Reporting and Analytics",
    "    4.8  Notification System",
    "    4.9  AI-Based Performance Analysis (Future)",
    "    4.10  Mobile Application (Future)",
    "5.  Other Nonfunctional Requirements",
    "    5.1  Performance Requirements", "    5.2  Safety Requirements",
    "    5.3  Security Requirements", "    5.4  Software Quality Attributes", "    5.5  Business Rules",
    "6.  Other Requirements",
    "Appendix A: Glossary", "Appendix B: Analysis Models",
    "Appendix C: Technology Stack", "Appendix D: Database Schema",
    "Appendix E: To Be Determined List",
]
for item in toc:
    p = doc.add_paragraph(item); p.paragraph_format.space_after=Pt(2); p.paragraph_format.space_before=Pt(0)
doc.add_paragraph()
doc.add_heading("Revision History", level=1)
add_tbl(doc, ["Name","Date","Reason For Changes","Version"], [
    ["Group E-17","Oct 2025","Initial draft with core modules","0.1"],
    ["Group E-17","Jan 2026","Added biometric, GPS, and advanced features","0.5"],
    ["Group E-17","Feb 2026","Final version — IEEE format restructure","1.0"],
])
doc.add_page_break()

# ====================== 1. INTRODUCTION ======================
doc.add_heading("1. Introduction", level=1)

doc.add_heading("1.1 Purpose", level=2)
doc.add_paragraph(
    "This document specifies the software requirements for the CA Firm Attendance and Article "
    "Management System, Version 1.0. The system is a web-based platform developed for SPCM "
    "(Chartered Accountant Firm) that digitizes and automates the management of article trainees "
    "in the firm."
)
doc.add_paragraph(
    "The system provides digital attendance tracking with biometric face recognition and GPS-based "
    "location verification, task assignment and management, real-time progress tracking, leave "
    "management, automated reporting, and performance monitoring. Future enhancements include "
    "AI-based performance analysis and a dedicated mobile application."
)
doc.add_paragraph(
    "This SRS covers the complete system comprising a React.js frontend, Node.js Express backend, "
    "MySQL database, and Python-based face recognition microservice."
)

doc.add_heading("1.2 Document Conventions", level=2)
doc.add_paragraph("This document follows these typographical conventions:")
bp(doc, [
    "Bold text indicates requirement IDs (e.g., REQ-AUTH-1).",
    "SHALL indicates a mandatory requirement implemented in the current version.",
    "SHOULD indicates a feature that is recommended and planned for future phases.",
    "Higher-level feature priorities are inherited by all child functional requirements unless overridden.",
    "All requirement IDs are unique and follow the format REQ-<MODULE>-<NUMBER>.",
])

doc.add_heading("1.3 Intended Audience and Reading Suggestions", level=2)
doc.add_paragraph("This document is intended for the following audiences:")
add_tbl(doc, ["Audience","Suggested Reading"], [
    ["SPCM (Sponsor CA Firm)","Sections 1, 2, 4 (features overview), and 5"],
    ["Development Team (Group E-17)","All sections, especially 3, 4, and Appendices C-D"],
    ["Project Guide (Prof. Disha Wankhede)","Complete document for academic evaluation"],
    ["Testers / QA","Sections 4 (functional requirements) and 5 (nonfunctional requirements)"],
    ["System Administrators","Sections 2.4, 2.5, 3, 5.3, and Appendix C"],
])
doc.add_paragraph(
    "Readers should begin with Sections 1 and 2 for project overview, proceed to Section 4 for "
    "detailed feature requirements, Section 3 for external interfaces, and Section 5 for quality "
    "attributes. Appendices provide technical reference material."
)

doc.add_heading("1.4 Product Scope", level=2)
doc.add_paragraph(
    "The CA Firm Attendance and Article Management System is a Major Project (Group E-17, AY 2025-2026) "
    "developed at Vishwakarma Institute of Technology, Pune, sponsored by SPCM (CA Firm). The software "
    "replaces traditional paper-based management of article trainees with a comprehensive digital platform."
)
doc.add_paragraph("Key objectives:")
bp(doc, [
    "Reduce paperwork by digitizing attendance registers, task records, leave applications, and performance reports",
    "Improve productivity by automating routine activities (attendance recording, task assignment, report generation)",
    "Track real-time progress of article trainees' work with percentage completion and status monitoring",
    "Improve communication between Chartered Accountants and article trainees through structured notifications",
    "Provide biometric face recognition attendance for fraud-proof identity verification",
    "Provide GPS-based attendance verification to ensure physical presence at office location",
    "Generate automated performance and attendance reports for data-driven decision making",
])
doc.add_paragraph("Future scope:")
bp(doc, [
    "AI-based performance analysis using machine learning to predict trainee productivity and provide recommendations",
    "Dedicated mobile application (React Native) for on-the-go attendance, task management, and notifications",
    "Integration with third-party HR/accounting software",
])

doc.add_heading("1.5 References", level=2)
refs = [
    "IEEE 830-1998 — IEEE Recommended Practice for Software Requirements Specifications",
    "React.js Documentation — https://react.dev/",
    "Node.js Documentation — https://nodejs.org/docs/",
    "Express.js Documentation — https://expressjs.com/",
    "MySQL Documentation — https://dev.mysql.com/doc/",
    "face-api.js — JavaScript Face Recognition Library — https://github.com/justadudewhohacks/face-api.js",
    "Geolocation API — https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API",
    "Chart.js — https://www.chartjs.org/",
    "JWT (JSON Web Tokens) — https://jwt.io/",
    "React Native Documentation — https://reactnative.dev/",
]
for i,ref in enumerate(refs,1): doc.add_paragraph(f"[{i}] {ref}")
doc.add_page_break()

# ====================== 2. OVERALL DESCRIPTION ======================
doc.add_heading("2. Overall Description", level=1)

doc.add_heading("2.1 Product Perspective", level=2)
doc.add_paragraph(
    "The CA Firm Attendance and Article Management System is a new, self-contained web application "
    "designed to replace traditional manual systems used in Chartered Accountant firms for managing "
    "article trainees. It is not a replacement of any existing software product. The system operates "
    "as a three-tier client-server architecture:"
)
bp(doc, [
    "Presentation Layer (Frontend) — React.js SPA with responsive design for desktop and mobile browsers",
    "Application Layer (Backend) — Node.js with Express.js RESTful API server handling business logic",
    "Data Layer (Database) — MySQL relational database for structured data storage with referential integrity",
    "Face Recognition Service — Python-based microservice using face-api.js/OpenCV for biometric attendance verification",
])
doc.add_paragraph(
    "The system uses JWT-based authentication, bcrypt password hashing, and role-based access control "
    "to ensure security. GPS coordinates from the browser Geolocation API verify physical presence "
    "during attendance marking."
)

doc.add_heading("2.2 Product Functions", level=2)
doc.add_paragraph("The major functions of the system are:")
add_tbl(doc, ["#","Function","Description"], [
    ["F1","User Authentication","Secure login/logout with JWT tokens, separate Admin and Article roles, password reset"],
    ["F2","Article Management","Admin CRUD operations for article trainee records (add, edit, remove, view)"],
    ["F3","Biometric Attendance","Face recognition-based attendance marking using camera capture and AI verification"],
    ["F4","GPS Attendance","Location-based attendance verification using browser Geolocation API with geofencing"],
    ["F5","Task Assignment","Admin creates, assigns, edits, and deletes tasks with deadlines for article trainees"],
    ["F6","Progress Tracking","Articles update task completion percentage; Admin monitors real-time progress"],
    ["F7","Leave Management","Articles apply for leave; Admin approves/rejects with history tracking"],
    ["F8","Reporting & Analytics","Automated attendance reports, performance reports, task completion statistics"],
    ["F9","Notification System","Push notifications for task assignments, deadlines, leave approvals, and reminders"],
    ["F10","AI Performance Analysis","(Future) ML-based productivity prediction and performance recommendations"],
    ["F11","Mobile Application","(Future) React Native mobile app for attendance, tasks, and notifications"],
])

doc.add_heading("2.3 User Classes and Characteristics", level=2)
add_tbl(doc, ["User Class","Description","Technical Expertise","Primary Functions"], [
    ["Admin (Chartered Accountant)","Firm partner/CA with full system control","Basic computer knowledge; daily use","Manage articles, assign tasks, monitor attendance/progress, approve leave, generate reports"],
    ["Article (Trainee)","CA articled trainee with limited access to own data","Basic mobile/computer knowledge; daily use","Mark attendance (face + GPS), view tasks, update progress, apply for leave, view own records"],
])
doc.add_paragraph(
    "The Admin user class is the primary controller with full access. Article trainees have restricted "
    "access limited to their own data and assigned tasks. Both user classes interact with the system daily."
)

doc.add_heading("2.4 Operating Environment", level=2)
add_tbl(doc, ["Component","Specification"], [
    ["Client Devices","Smartphones, tablets, laptops, desktop computers"],
    ["Supported Browsers","Google Chrome (recommended), Microsoft Edge, Firefox, Safari"],
    ["Camera","Required for face recognition attendance (front-facing webcam or mobile camera)"],
    ["GPS","Browser Geolocation API support required for location-based attendance"],
    ["Server Runtime","Node.js v16+ (backend), Python 3.8+ (face recognition service)"],
    ["Database","MySQL 8.0+ (local or cloud-hosted)"],
    ["Cloud Hosting","AWS / Google Cloud / Render.com (scalable platform)"],
    ["Network","Stable internet connection required (minimum 1 Mbps, recommended 5 Mbps)"],
    ["Mobile Optimization","Responsive design for mobile screens"],
])

doc.add_heading("2.5 Design and Implementation Constraints", level=2)
bp(doc, [
    "Frontend must use React.js with responsive design for both desktop and mobile browsers.",
    "Backend must use Node.js with Express.js framework for RESTful API development.",
    "Database must use MySQL with proper relational schema and referential integrity.",
    "Face recognition must work via browser camera access (HTTPS required for camera permissions).",
    "GPS attendance requires HTTPS and browser Geolocation API permission from user.",
    "Geofencing radius for GPS attendance must be configurable (default: 100m from office location).",
    "Attendance can be marked only once per day per article trainee.",
    "All passwords must be encrypted using bcrypt before storage.",
    "JWT tokens used for authentication with configurable expiration.",
    "System designed for a single CA firm (SPCM) with potential for multi-tenant expansion.",
])

doc.add_heading("2.6 User Documentation", level=2)
bp(doc, [
    "This SRS document (Software Requirements Specification)",
    "User manual for Admin operations (task assignment, report generation, leave management)",
    "User guide for Article trainees (attendance marking, task updates, leave application)",
    "Setup and deployment documentation in repository README files",
    "API documentation for backend endpoints",
])

doc.add_heading("2.7 Assumptions and Dependencies", level=2)
doc.add_paragraph("Assumptions:")
bp(doc, [
    "Users have internet-enabled devices with modern web browsers.",
    "Article trainees' devices have a front-facing camera for face recognition.",
    "Browser supports Geolocation API and user grants location permission.",
    "SPCM office location coordinates are preconfigured in the system for geofencing.",
    "Admin (CA) has basic computer literacy to operate the dashboard.",
    "All article trainees are registered by Admin before they can access the system.",
])
doc.add_paragraph("Dependencies:")
bp(doc, [
    "face-api.js / OpenCV — Face recognition library for biometric attendance verification",
    "Browser Geolocation API — GPS coordinates for location-based attendance",
    "MySQL Server — Relational data storage for all system records",
    "Node.js + Express.js — Backend API server and business logic processing",
    "React.js — Frontend single-page application framework",
    "JWT (jsonwebtoken) — Token-based authentication mechanism",
    "bcrypt — Password hashing library",
    "Nodemailer / Firebase Cloud Messaging — Notification delivery (email/push)",
    "Chart.js — Data visualization for reports and analytics dashboards",
])
doc.add_page_break()

# ====================== 3. EXTERNAL INTERFACE REQUIREMENTS ======================
doc.add_heading("3. External Interface Requirements", level=1)

doc.add_heading("3.1 User Interfaces", level=2)
doc.add_paragraph("Admin interfaces:")
bp(doc, [
    "Login Page — Secure authentication form with username and password",
    "Admin Dashboard — Overview with attendance summary, pending tasks, leave requests, key metrics",
    "Article Management Page — Add, edit, remove article trainees with profile details",
    "Task Management Page — Create, assign, edit, delete tasks with deadline setting",
    "Attendance Monitoring Page — View daily/monthly attendance records for all articles",
    "Progress Monitoring Page — Real-time view of task completion percentages per article",
    "Leave Management Page — Approve/reject leave requests with history",
    "Reports Page — Generate and view attendance reports, performance reports, task completion statistics",
    "Settings Page — Configure office location (GPS coordinates), geofencing radius, system preferences",
])
doc.add_paragraph("Article interfaces:")
bp(doc, [
    "Login Page — Secure authentication for article trainees",
    "Article Dashboard — Personal overview with assigned tasks, attendance status, notifications",
    "Attendance Page — Face recognition camera capture + GPS verification for marking attendance",
    "Task View Page — List of assigned tasks with deadlines, descriptions, and status indicators",
    "Progress Update Page — Update task completion percentage and add remarks",
    "Leave Application Page — Submit leave requests with date selection and reason",
    "Attendance History Page — View personal attendance records and statistics",
])
doc.add_paragraph("All interfaces are responsive (desktop and mobile), use consistent navigation, Chart.js for data "
    "visualization, and follow modern UI/UX design principles with clear buttons and readable text.")

doc.add_heading("3.2 Hardware Interfaces", level=2)
bp(doc, [
    "Camera — Front-facing webcam or mobile camera required for face recognition attendance (minimum 720p)",
    "GPS Module — Device GPS or browser Geolocation API for location-based attendance verification",
    "No dedicated server hardware required — system runs on cloud infrastructure",
])

doc.add_heading("3.3 Software Interfaces", level=2)
add_tbl(doc, ["Software","Type","Purpose","Data Exchange"], [
    ["MySQL 8.0+","RDBMS (TCP)","Primary data storage for all records","SQL queries via mysql2/Sequelize ORM"],
    ["face-api.js","JavaScript Library","Face detection, recognition, and landmark analysis","Canvas/image data, face descriptor vectors"],
    ["Browser Geolocation API","Web API","Retrieve device GPS coordinates for attendance","JSON — latitude, longitude, accuracy"],
    ["Chart.js","JavaScript Library","Data visualization for reports and dashboards","JSON data rendered as charts"],
    ["Nodemailer","Node.js Library","Email notifications for leave approvals, task reminders","SMTP — email composition and delivery"],
    ["Firebase Cloud Messaging","Cloud Service","Push notifications to browser/mobile","JSON — notification payload via HTTPS"],
])

doc.add_heading("3.4 Communications Interfaces", level=2)
bp(doc, [
    "HTTP/HTTPS — Primary protocol for all web and API communication (HTTPS required for camera/GPS access)",
    "JSON — Standard data exchange format for all API requests and responses",
    "JWT Bearer Tokens — Stateless authentication stored in HTTP-only cookies or Authorization headers",
    "SMTP — Email protocol for notification delivery via Nodemailer",
    "FCM (Firebase Cloud Messaging) — Push notification delivery protocol",
    "WebSocket (future) — Real-time notifications and live progress updates",
])
doc.add_page_break()

# ====================== 4. SYSTEM FEATURES ======================
doc.add_heading("4. System Features", level=1)
doc.add_paragraph(
    "This section organizes the functional requirements by system features. Each feature includes "
    "a description with priority, stimulus/response sequences, and uniquely identified functional requirements."
)

# 4.1 Authentication
add_feature(doc, 1, "User Authentication and Session Management", "High",
    "Provides secure login and logout for Admin (CA) and Article (Trainee) users. Implements "
    "JWT-based authentication with role-based access control. Includes password reset functionality "
    "and automatic session expiration for security.",
    [
        "User navigates to Login page -> enters username and password -> system verifies credentials -> checks user type (Admin/Article) -> issues JWT token -> redirects to appropriate dashboard",
        "User clicks Logout -> system invalidates JWT token/clears cookie -> redirects to Login page",
        "User requests password reset -> system sends reset link via email -> user sets new password",
        "Session expires after inactivity period -> system redirects to Login page with session expired message",
    ],
    [
        ("REQ-AUTH-1","The system shall provide separate login functionality for Admin and Article users with username and password."),
        ("REQ-AUTH-2","The system shall authenticate users using JWT tokens with configurable expiration (default: 24 hours)."),
        ("REQ-AUTH-3","The system shall implement role-based access control (RBAC) with Admin and Article roles."),
        ("REQ-AUTH-4","The system shall hash all passwords using bcrypt with a minimum of 10 salt rounds before storage."),
        ("REQ-AUTH-5","The system shall display appropriate error messages for invalid login credentials."),
        ("REQ-AUTH-6","The system shall provide secure logout functionality that terminates the user session."),
        ("REQ-AUTH-7","The system shall provide password reset functionality via email verification."),
        ("REQ-AUTH-8","The system shall automatically expire sessions after a configurable inactivity timeout (default: 30 minutes)."),
        ("REQ-AUTH-9","The system shall prevent concurrent login from multiple devices for the same account."),
    ]
)

# 4.2 Article Management
add_feature(doc, 2, "Article Trainee Management", "High",
    "Enables Admin (CA) to manage article trainee records. Provides full CRUD operations for trainee "
    "profiles including registration, editing, deactivation, and viewing. Article trainees cannot "
    "self-register — only Admin can create accounts.",
    [
        "Admin navigates to Article Management -> clicks 'Add Article' -> fills trainee details (name, email, phone, username, password) -> system validates uniqueness -> creates account -> sends credentials to trainee via email",
        "Admin selects existing article -> edits details -> system saves changes",
        "Admin selects article -> clicks 'Remove' -> system confirms -> deactivates account",
        "Admin views list of all article trainees with status, attendance summary, and task count",
    ],
    [
        ("REQ-ART-1","The system shall allow Admin to add new article trainees with name, email, phone number, username, and password."),
        ("REQ-ART-2","The system shall enforce unique constraints on username and email for article accounts."),
        ("REQ-ART-3","The system shall allow Admin to edit article trainee details."),
        ("REQ-ART-4","The system shall allow Admin to remove/deactivate article trainee accounts."),
        ("REQ-ART-5","The system shall display a list of all article trainees with their current status and summary metrics."),
        ("REQ-ART-6","The system shall send login credentials to newly added article trainees via email."),
        ("REQ-ART-7","The system shall store article trainee face data during registration for biometric attendance."),
    ]
)

# 4.3 Attendance (Biometric + GPS)
add_feature(doc, 3, "Attendance Management (Biometric Face Recognition + GPS)", "High",
    "Core attendance module implementing dual-factor verification: biometric face recognition using "
    "the device camera and GPS-based location verification using the browser Geolocation API. "
    "Ensures fraud-proof attendance by verifying both identity (face match) and physical presence "
    "(GPS within geofenced office radius). Admin can view and generate attendance reports.",
    [
        "Article opens Attendance page -> system requests camera permission -> captures live face image -> face-api.js compares with registered face descriptor -> if match confirmed, proceeds to GPS check",
        "System requests GPS permission -> retrieves device coordinates -> calculates distance from office location using Haversine formula -> if within geofence radius (100m), attendance marked -> date and time recorded automatically",
        "If face does not match -> attendance denied with 'Face verification failed' message",
        "If GPS location outside geofence -> attendance denied with 'You are not at the office location' message",
        "Admin views daily/monthly attendance -> system retrieves records from database -> displays in tabular format with export option",
    ],
    [
        ("REQ-ATT-1","The system shall allow article trainees to mark attendance using biometric face recognition via device camera."),
        ("REQ-ATT-2","The system shall capture a live face image and compare it against the registered face descriptor using face-api.js with a minimum confidence threshold of 0.6 (60%)."),
        ("REQ-ATT-3","The system shall verify GPS location using the browser Geolocation API before confirming attendance."),
        ("REQ-ATT-4","The system shall implement geofencing with a configurable radius (default: 100m) from the preconfigured office coordinates."),
        ("REQ-ATT-5","The system shall calculate distance from office using the Haversine formula."),
        ("REQ-ATT-6","The system shall automatically record the date and time when attendance is marked."),
        ("REQ-ATT-7","The system shall enforce a one-attendance-per-day policy per article trainee."),
        ("REQ-ATT-8","The system shall store attendance records with article ID, date, time, GPS coordinates, face match confidence score, and status (Present/Absent/Late)."),
        ("REQ-ATT-9","The system shall allow Admin to view daily and monthly attendance records for all articles."),
        ("REQ-ATT-10","The system shall generate exportable attendance reports (PDF/CSV) for selected date ranges."),
        ("REQ-ATT-11","The system shall support marking check-in and check-out times to calculate working hours."),
        ("REQ-ATT-12","The system shall display attendance summary statistics (present days, absent days, late arrivals, average working hours) per article."),
    ]
)

# 4.4 Task Management
add_feature(doc, 4, "Task Assignment and Management", "High",
    "Enables Admin to create, assign, edit, and delete tasks for article trainees. Tasks include "
    "title, description, deadline, priority level, and assigned article. Articles can view their "
    "assigned tasks with clear deadline indicators.",
    [
        "Admin clicks 'Create Task' -> fills task title, description, deadline, priority, selects article(s) -> system creates and assigns task -> notification sent to article",
        "Admin edits existing task (description, deadline, reassignment) -> system saves changes -> notifies affected articles",
        "Admin deletes task -> system confirms -> removes task record",
        "Article logs in -> views assigned task list sorted by deadline -> sees task details, priority indicators, and status",
    ],
    [
        ("REQ-TASK-1","The system shall allow Admin to create new tasks with title, description, deadline, and priority (High/Medium/Low)."),
        ("REQ-TASK-2","The system shall allow Admin to assign tasks to one or multiple article trainees."),
        ("REQ-TASK-3","The system shall allow Admin to edit existing tasks (title, description, deadline, priority, assignment)."),
        ("REQ-TASK-4","The system shall allow Admin to delete tasks with confirmation."),
        ("REQ-TASK-5","The system shall display assigned tasks to article trainees sorted by deadline."),
        ("REQ-TASK-6","The system shall provide task status indicators: Not Started, In Progress, Completed, Overdue."),
        ("REQ-TASK-7","The system shall send notifications to articles when a new task is assigned or deadline is approaching."),
        ("REQ-TASK-8","The system shall highlight overdue tasks with visual indicators for both Admin and Article views."),
        ("REQ-TASK-9","The system shall allow Admin to set task categories (e.g., Audit, Tax Filing, GST, Bookkeeping, Compliance)."),
    ]
)

# 4.5 Progress Tracking
add_feature(doc, 5, "Progress Tracking and Monitoring", "High",
    "Allows article trainees to update their task progress with completion percentage and remarks. "
    "Admin can monitor all articles' progress in real-time with visual indicators and summary views.",
    [
        "Article selects a task -> updates completion percentage (0-100%) -> adds remarks/comments -> system saves progress -> Admin can see update in real-time",
        "Article marks task as 'Completed' (100%) -> system updates status -> Admin receives notification",
        "Admin navigates to Progress page -> views all articles' progress with percentage bars and pending/completed counts",
    ],
    [
        ("REQ-PROG-1","The system shall allow article trainees to update task progress with completion percentage (0-100%)."),
        ("REQ-PROG-2","The system shall allow articles to add remarks or comments when updating progress."),
        ("REQ-PROG-3","The system shall allow articles to mark tasks as completed."),
        ("REQ-PROG-4","The system shall display real-time progress to Admin with visual progress bars per article."),
        ("REQ-PROG-5","The system shall show summary view: tasks completed, tasks pending, tasks overdue per article."),
        ("REQ-PROG-6","The system shall maintain a progress history log with timestamps for each update."),
        ("REQ-PROG-7","The system shall calculate overall task completion rate per article and per task category."),
    ]
)

# 4.6 Leave Management
add_feature(doc, 6, "Leave Management", "Medium",
    "Manages leave requests from article trainees. Articles apply for leave with date and reason; "
    "Admin approves or rejects with optional comments. System maintains complete leave history.",
    [
        "Article navigates to Leave page -> selects leave date(s) -> enters reason -> submits request -> notification sent to Admin",
        "Admin views pending leave requests -> approves or rejects with optional comment -> notification sent to article",
        "Admin/Article views leave history with status filters (Approved, Rejected, Pending)",
    ],
    [
        ("REQ-LEAVE-1","The system shall allow article trainees to apply for leave with start date, end date, and reason."),
        ("REQ-LEAVE-2","The system shall allow Admin to approve leave requests."),
        ("REQ-LEAVE-3","The system shall allow Admin to reject leave requests with an optional reason."),
        ("REQ-LEAVE-4","The system shall maintain a complete leave history for each article trainee."),
        ("REQ-LEAVE-5","The system shall send notifications to Admin when leave is applied and to Article when leave is approved/rejected."),
        ("REQ-LEAVE-6","The system shall prevent leave application for dates that have already passed."),
        ("REQ-LEAVE-7","The system shall display leave balance/summary (total leaves taken, remaining) per article."),
        ("REQ-LEAVE-8","The system shall automatically update attendance records to reflect approved leave days."),
    ]
)

# 4.7 Reporting
add_feature(doc, 7, "Reporting and Analytics", "High",
    "Generates automated reports for attendance, performance, and task completion. Provides visual "
    "analytics dashboards with Chart.js for data-driven decision making.",
    [
        "Admin selects 'Attendance Report' -> chooses date range and article(s) -> system generates tabular report with present/absent/late counts -> option to export as PDF/CSV",
        "Admin selects 'Performance Report' -> system shows task completion rates, progress trends, and comparative metrics across articles",
        "Admin views Analytics Dashboard -> Chart.js renders attendance trends, task distribution, and performance comparisons",
    ],
    [
        ("REQ-RPT-1","The system shall generate daily attendance reports showing present, absent, and late counts."),
        ("REQ-RPT-2","The system shall generate monthly attendance reports with summary statistics per article."),
        ("REQ-RPT-3","The system shall generate performance reports showing tasks completed, pending, and overdue per article."),
        ("REQ-RPT-4","The system shall provide an analytics dashboard with visual charts (bar, line, pie) using Chart.js."),
        ("REQ-RPT-5","The system shall allow export of reports in PDF and CSV formats."),
        ("REQ-RPT-6","The system shall provide comparative performance views across all articles."),
        ("REQ-RPT-7","The system shall display task category-wise distribution and completion metrics."),
        ("REQ-RPT-8","The system shall show attendance trend analysis (weekly, monthly) with visual graphs."),
    ]
)

# 4.8 Notifications
add_feature(doc, 8, "Notification System", "Medium",
    "Delivers timely notifications to both Admin and Article users for important events such as "
    "task assignments, deadline reminders, leave approvals, and attendance alerts.",
    [
        "New task assigned -> system sends in-app notification + email to article trainee",
        "Deadline approaching (24h before) -> system sends reminder notification to article",
        "Leave approved/rejected -> system sends notification to article",
        "Article marks attendance -> Admin receives summary notification",
    ],
    [
        ("REQ-NOTIF-1","The system shall send in-app notifications for task assignments, approvals, and reminders."),
        ("REQ-NOTIF-2","The system shall send email notifications for critical events (leave approval, new task, deadline)."),
        ("REQ-NOTIF-3","The system shall send deadline reminder notifications 24 hours before task deadline."),
        ("REQ-NOTIF-4","The system shall maintain a notification history accessible to each user."),
        ("REQ-NOTIF-5","The system shall display unread notification count in the navigation bar."),
    ]
)

# 4.9 AI Performance Analysis (Future)
add_feature(doc, 9, "AI-Based Performance Analysis (Future Enhancement)", "Low",
    "A planned future module that uses machine learning algorithms to analyze article trainee "
    "performance data and provide predictive insights. This module will analyze attendance patterns, "
    "task completion rates, deadline adherence, and working hours to generate performance scores "
    "and improvement recommendations.",
    [
        "System collects historical data (attendance, task completion, deadlines met/missed) for each article",
        "ML model processes data -> generates performance score (0-100) and trend prediction",
        "Admin views AI Performance Dashboard -> sees predicted performance, risk indicators, and recommendations",
        "System flags underperforming articles with early warning alerts and suggests corrective actions",
    ],
    [
        ("REQ-AI-1","The system SHOULD implement an ML model to analyze article trainee performance based on historical data (attendance regularity, task completion rate, deadline adherence, working hours)."),
        ("REQ-AI-2","The system SHOULD generate a performance score (0-100) for each article trainee using weighted metrics."),
        ("REQ-AI-3","The system SHOULD predict future performance trends using time-series analysis."),
        ("REQ-AI-4","The system SHOULD provide automated improvement recommendations based on identified weak areas."),
        ("REQ-AI-5","The system SHOULD flag underperforming trainees with early warning indicators for Admin review."),
        ("REQ-AI-6","The system SHOULD provide comparative analytics benchmarking each article against team averages."),
        ("REQ-AI-7","The system SHOULD use scikit-learn or TensorFlow for model training and inference."),
    ]
)

# 4.10 Mobile App (Future)
add_feature(doc, 10, "Mobile Application (Future Enhancement)", "Low",
    "A dedicated mobile application built using React Native for cross-platform (iOS and Android) "
    "support. The mobile app will provide on-the-go access to attendance marking, task management, "
    "notifications, and reporting with native camera and GPS integration.",
    [
        "Article opens mobile app -> marks attendance using native camera (face recognition) and GPS",
        "Article views assigned tasks, updates progress, and applies for leave from mobile",
        "Admin receives push notifications and can approve/reject leave from mobile",
        "Mobile app syncs data with backend API in real-time",
    ],
    [
        ("REQ-MOB-1","The system SHOULD provide a React Native mobile application for iOS and Android platforms."),
        ("REQ-MOB-2","The mobile app SHOULD support biometric face recognition using native camera APIs."),
        ("REQ-MOB-3","The mobile app SHOULD support GPS-based attendance using native location services."),
        ("REQ-MOB-4","The mobile app SHOULD provide push notifications via Firebase Cloud Messaging."),
        ("REQ-MOB-5","The mobile app SHOULD allow task viewing, progress updates, and leave application."),
        ("REQ-MOB-6","The mobile app SHOULD sync with the backend API in real-time."),
        ("REQ-MOB-7","The mobile app SHOULD support offline mode with data sync when connectivity is restored."),
    ]
)
doc.add_page_break()

# ====================== 5. NONFUNCTIONAL REQUIREMENTS ======================
doc.add_heading("5. Other Nonfunctional Requirements", level=1)

doc.add_heading("5.1 Performance Requirements", level=2)
bp(doc, [
    "Page load time shall not exceed 3 seconds under normal network conditions.",
    "API response time shall be less than 500ms for standard CRUD operations.",
    "Face recognition processing shall complete within 3 seconds per capture.",
    "GPS location retrieval shall complete within 5 seconds.",
    "The system shall support at least 200 concurrent users without performance degradation.",
    "Report generation shall complete within 10 seconds for up to 1 year of data.",
    "Database queries shall be optimized with proper indexing for fast retrieval.",
])

doc.add_heading("5.2 Safety Requirements", level=2)
doc.add_paragraph(
    "The system handles personal data of article trainees (face images, GPS coordinates, contact "
    "information). All biometric data (face descriptors) must be stored securely and handled in "
    "compliance with data protection best practices. Face images captured during attendance shall "
    "not be stored permanently — only face descriptor vectors are retained for comparison. GPS "
    "coordinates are used solely for attendance verification and not for continuous tracking."
)

doc.add_heading("5.3 Security Requirements", level=2)
bp(doc, [
    "All passwords shall be encrypted using bcrypt with minimum 10 salt rounds.",
    "Authentication shall use JWT tokens with configurable expiration.",
    "Role-based access control shall restrict Admin and Article access appropriately.",
    "HTTPS shall be used for all communications (mandatory for camera and GPS browser APIs).",
    "Sessions shall expire automatically after configurable inactivity timeout.",
    "Face descriptor data shall be encrypted at rest in the database.",
    "SQL injection prevention through parameterized queries / ORM (Sequelize).",
    "XSS prevention through input sanitization on both frontend and backend.",
    "API endpoints shall validate all inputs before processing.",
    "Unauthorized access attempts shall be logged for security auditing.",
])

doc.add_heading("5.4 Software Quality Attributes", level=2)
doc.add_paragraph("Reliability:")
bp(doc, [
    "System uptime shall be at least 99% during business hours (9 AM - 7 PM).",
    "Data shall not be lost during system failures — database backups scheduled daily.",
    "System shall recover from errors gracefully with appropriate error messages.",
])
doc.add_paragraph("Usability:")
bp(doc, [
    "Interface shall be simple, intuitive, and usable by users with basic computer knowledge.",
    "Navigation shall be consistent across all pages with clear buttons and readable text.",
    "System shall provide helpful feedback messages for all user actions.",
    "Responsive design shall ensure usability on both desktop and mobile screens.",
])
doc.add_paragraph("Maintainability:")
bp(doc, [
    "Codebase shall follow MVC architecture pattern with clear separation of concerns.",
    "Code shall be modular to allow easy addition of new features.",
    "Version control (Git) shall be used for all code changes.",
    "Database schema shall support easy migration and updates.",
])
doc.add_paragraph("Portability:")
bp(doc, [
    "System shall be deployable on any cloud platform supporting Node.js and MySQL.",
    "Configuration shall be externalized via environment variables for easy portability.",
])

doc.add_heading("5.5 Business Rules", level=2)
bp(doc, [
    "Only Admin (CA) can create, edit, and delete article trainee accounts.",
    "Article trainees cannot self-register — registration is done by Admin only.",
    "Attendance can be marked only once per day per article trainee.",
    "Attendance requires both face verification AND GPS verification to be successful.",
    "Only Admin can approve or reject leave requests.",
    "Leave cannot be applied for past dates.",
    "Only Admin can assign, edit, or delete tasks.",
    "Article trainees can only view and update progress on their own assigned tasks.",
    "Reports are accessible only to Admin users.",
    "Performance data and reports are confidential and accessible only to Admin.",
])
doc.add_page_break()

# ====================== 6. OTHER REQUIREMENTS ======================
doc.add_heading("6. Other Requirements", level=1)
doc.add_paragraph(
    "The system shall be developed using Agile methodology with weekly sprints. Git/GitHub shall "
    "be used for version control. The system is designed primarily for SPCM (CA Firm) but the "
    "architecture should support future multi-tenant deployment for other CA firms."
)
doc.add_paragraph(
    "The database shall maintain referential integrity with foreign key constraints. All date/time "
    "records shall use IST (Indian Standard Time, UTC+5:30). The system shall support data export "
    "in CSV and PDF formats for administrative reporting needs."
)
doc.add_page_break()

# ====================== APPENDICES ======================

# Appendix A: Glossary
doc.add_heading("Appendix A: Glossary", level=1)
add_tbl(doc, ["Term","Definition"], [
    ["CA","Chartered Accountant — the supervising professional"],
    ["Article / Articled Trainee","A student undergoing practical training under a Chartered Accountant as per ICAI regulations"],
    ["SPCM","Sponsoring CA firm for this project"],
    ["JWT","JSON Web Token — stateless authentication mechanism"],
    ["RBAC","Role-Based Access Control — restricts access based on user role"],
    ["Geofencing","Virtual geographic boundary for location-based attendance verification"],
    ["Haversine Formula","Mathematical formula to calculate distance between two GPS coordinates on Earth's surface"],
    ["Face Descriptor","A numerical vector representation of facial features used for face recognition comparison"],
    ["CRUD","Create, Read, Update, Delete — basic data operations"],
    ["SPA","Single-Page Application — a web app that loads once and dynamically updates content"],
    ["ORM","Object-Relational Mapping — bridges application code and database (e.g., Sequelize)"],
    ["ICAI","Institute of Chartered Accountants of India"],
])
doc.add_paragraph()

# Appendix B: Analysis Models
doc.add_heading("Appendix B: Analysis Models", level=1)
doc.add_paragraph("System Architecture (Three-Tier):")
doc.add_paragraph(
    "Tier 1 (Presentation): React.js SPA with responsive design\n"
    "Tier 2 (Application): Node.js + Express.js REST API\n"
    "Tier 3 (Data): MySQL relational database\n"
    "Auxiliary: Python face recognition microservice"
)
doc.add_paragraph()
doc.add_paragraph("Data Flow — Attendance Marking:")
doc.add_paragraph(
    "1. Article opens Attendance page -> Frontend requests camera access\n"
    "2. Live face image captured via browser MediaDevices API\n"
    "3. face-api.js processes image -> extracts face descriptor vector\n"
    "4. Descriptor compared against registered face data (Euclidean distance, threshold: 0.6)\n"
    "5. If face match: Frontend requests GPS coordinates via Geolocation API\n"
    "6. Coordinates sent to Backend -> Haversine distance calculated from office location\n"
    "7. If within geofence radius (100m): Attendance record created with timestamp\n"
    "8. Backend stores: article_id, date, time, GPS coords, face confidence, status\n"
    "9. Success response -> Frontend displays 'Attendance Marked Successfully'"
)
doc.add_paragraph()
doc.add_paragraph("Data Flow — Task Assignment:")
doc.add_paragraph(
    "1. Admin creates task (title, description, deadline, priority, category)\n"
    "2. Admin selects articles(s) for assignment\n"
    "3. Backend creates task record and assignment records in database\n"
    "4. Notification sent to assigned article(s) via email and in-app notification\n"
    "5. Article views task on dashboard -> updates progress -> Backend updates record\n"
    "6. When 100% -> Backend marks task complete -> notifies Admin"
)
doc.add_page_break()

# Appendix C: Technology Stack
doc.add_heading("Appendix C: Technology Stack", level=1)
doc.add_paragraph("Frontend:")
add_tbl(doc, ["Category","Technology","Purpose"], [
    ["Framework","React.js 18+","Single-page application UI"],
    ["State Management","React Context API / Redux","Global state management"],
    ["Routing","React Router DOM 6+","Client-side navigation"],
    ["Styling","CSS3 / Bootstrap 5 / Material UI","Responsive design and UI components"],
    ["Charts","Chart.js + react-chartjs-2","Data visualization for reports"],
    ["Face Recognition","face-api.js","Browser-based face detection and recognition"],
    ["HTTP Client","Axios","API communication with backend"],
])
doc.add_paragraph()
doc.add_paragraph("Backend:")
add_tbl(doc, ["Category","Technology","Purpose"], [
    ["Runtime","Node.js v16+","Server-side JavaScript execution"],
    ["Framework","Express.js 4.x","RESTful API development"],
    ["Database ORM","Sequelize / mysql2","MySQL database interaction"],
    ["Authentication","jsonwebtoken (JWT)","Token-based user authentication"],
    ["Password Hashing","bcryptjs","Secure password encryption"],
    ["Email","Nodemailer","Email notification delivery"],
    ["Validation","express-validator","API input validation"],
    ["File Upload","Multer","Handling file uploads (face images)"],
    ["Push Notifications","Firebase Admin SDK","Push notification delivery"],
])
doc.add_paragraph()
doc.add_paragraph("Database:")
add_tbl(doc, ["Category","Technology","Purpose"], [
    ["RDBMS","MySQL 8.0+","Primary relational data storage"],
    ["Hosting","AWS RDS / Local MySQL Server","Database hosting"],
])
doc.add_paragraph()
doc.add_paragraph("Future Technologies:")
add_tbl(doc, ["Category","Technology","Purpose"], [
    ["Mobile App","React Native","Cross-platform mobile application (iOS + Android)"],
    ["AI/ML","scikit-learn / TensorFlow","Performance analysis and prediction models"],
    ["Real-time","Socket.io","Live notifications and progress updates"],
])
doc.add_page_break()

# Appendix D: Database Schema
doc.add_heading("Appendix D: Database Schema", level=1)
doc.add_paragraph("Key database tables:")
add_tbl(doc, ["Table","Key Columns","Purpose"], [
    ["admins","admin_id (PK), name, email, username, password_hash","Admin (CA) accounts"],
    ["articles","article_id (PK), name, email, phone, username, password_hash, face_descriptor, status","Article trainee accounts with face data"],
    ["attendance","attendance_id (PK), article_id (FK), date, check_in_time, check_out_time, gps_lat, gps_lng, face_confidence, status","Attendance records with biometric/GPS data"],
    ["tasks","task_id (PK), title, description, deadline, priority, category, created_by (FK), status","Task definitions"],
    ["task_assignments","assignment_id (PK), task_id (FK), article_id (FK), progress_percentage, remarks, status","Task-to-article assignments with progress"],
    ["progress_log","log_id (PK), assignment_id (FK), progress_percentage, remarks, timestamp","Progress update history"],
    ["leave_requests","leave_id (PK), article_id (FK), start_date, end_date, reason, status, admin_comment","Leave applications with approval status"],
    ["notifications","notification_id (PK), user_id, user_type, message, type, is_read, timestamp","In-app notification records"],
    ["settings","setting_id (PK), key, value","System configuration (office GPS, geofence radius, etc.)"],
])
doc.add_paragraph()

# Appendix E: TBD List
doc.add_heading("Appendix E: To Be Determined List", level=1)
add_tbl(doc, ["#","Item","Status","Target Phase"], [
    ["TBD-1","Specific ML model selection for AI performance analysis","Open","Phase 2"],
    ["TBD-2","Training data requirements and feature engineering for performance prediction","Open","Phase 2"],
    ["TBD-3","React Native mobile app UI/UX design specifications","Open","Phase 2"],
    ["TBD-4","Offline data sync strategy for mobile app","Open","Phase 2"],
    ["TBD-5","Third-party HR/accounting software integration API specifications","Open","Phase 3"],
    ["TBD-6","Multi-tenant deployment architecture for serving multiple CA firms","Open","Phase 3"],
    ["TBD-7","ICAI compliance requirements for article trainee record-keeping","Under Review","Phase 1"],
])

# ====================== END ======================
doc.add_paragraph(); doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("— End of SRS Document —"); r.bold = True; r.font.size = Pt(14)

output = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nivesh project", "SRS_CA_Firm_IEEE.docx")
doc.save(output)
print(f"Done: {output}")
