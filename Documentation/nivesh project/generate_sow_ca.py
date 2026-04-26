from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = Document()

# Set default font
style = doc.styles['Normal']
font = style.font
font.name = 'Times New Roman'
font.size = Pt(12)

# ============================================================
# TITLE
# ============================================================
title = doc.add_heading('Statement of Work (SOW)', level=1)
for run in title.runs:
    run.font.size = Pt(16)
    run.font.color.rgb = RGBColor(0, 0, 0)

# ============================================================
# 1. PROJECT TITLE
# ============================================================
doc.add_heading('1. Project Title', level=2)
doc.add_paragraph('CA Firm Attendance and Article Management System')

# ============================================================
# 2. VISION
# ============================================================
doc.add_heading('2. Vision', level=2)
doc.add_paragraph(
    'The vision of this project is to develop a comprehensive, secure, and intelligent digital platform '
    'for SPCM (Chartered Accountant Firm) that modernizes the management of article trainees by replacing '
    'traditional paper-based workflows with an integrated web-based system. The platform will unify '
    'attendance tracking with biometric face recognition and GPS-based verification, task assignment and '
    'progress monitoring, leave management, automated reporting, and performance analytics into a single '
    'cohesive solution. By leveraging AI-based performance analysis and a dedicated mobile application in '
    'future phases, the system aims to significantly enhance productivity, transparency, and accountability '
    'within the CA firm, enabling data-driven decision-making for Chartered Accountants while providing '
    'article trainees with a seamless and efficient digital work experience.'
)

# ============================================================
# 3. PROBLEM STATEMENT
# ============================================================
doc.add_heading('3. Problem Statement', level=2)
doc.add_paragraph(
    'Chartered Accountant firms like SPCM currently rely on fragmented, manual, and paper-based systems '
    'for managing article trainees. Attendance is tracked through physical registers that are prone to '
    'proxy attendance and manipulation, making it difficult to verify the actual presence of trainees. '
    'Task assignments are communicated verbally or via informal channels, leading to miscommunication, '
    'missed deadlines, and lack of accountability. Progress tracking is ad-hoc, with no real-time '
    'visibility into task completion status, making it challenging for CAs to monitor trainee productivity. '
    'Leave management involves manual applications and approvals, resulting in record-keeping '
    'inconsistencies. Furthermore, performance evaluation is subjective and lacks data-backed insights, '
    'hindering fair assessment of trainee contributions. The absence of a centralized, automated system '
    'creates operational inefficiencies, reduces transparency, and limits the firm\'s ability to manage '
    'its article trainees effectively.'
)

# ============================================================
# 4. GOALS
# ============================================================
doc.add_heading('4. Goals', level=2)
doc.add_paragraph('The primary goals of this project are:')
goals = [
    'To digitize and automate the complete article trainee management lifecycle, eliminating paper-based processes and manual record-keeping',
    'To implement fraud-proof attendance tracking using dual-factor verification combining biometric face recognition and GPS-based geofencing',
    'To provide a structured task assignment and progress monitoring system with real-time visibility for Chartered Accountants',
    'To streamline leave management with digital applications, approvals, and automated record maintenance',
    'To generate automated, data-driven reports and analytics for attendance, performance, and task completion',
    'To improve communication and accountability between Chartered Accountants and article trainees through structured notifications and progress tracking',
    'To build a scalable and secure platform that can accommodate future enhancements including AI-based performance analysis and mobile application integration',
    'To ensure compliance with professional standards and data protection best practices for handling trainee biometric and personal data',
]
for g in goals:
    doc.add_paragraph(f'- {g}', style='List Bullet')

# ============================================================
# 5. OBJECTIVES
# ============================================================
doc.add_heading('5. Objectives', level=2)
objectives = [
    'Design and develop a full-stack web application using React.js frontend, Node.js (Express.js) backend, MySQL database, and a Python-based face recognition microservice',
    'Implement biometric face recognition attendance using face-api.js with a minimum confidence threshold of 60% for identity verification',
    'Implement GPS-based attendance verification using the browser Geolocation API with configurable geofencing radius (default: 100m from office location)',
    'Build a task management module enabling Admin to create, assign, edit, and prioritize tasks (High/Medium/Low) with deadline tracking and category classification (Audit, Tax Filing, GST, Bookkeeping, Compliance)',
    'Develop a real-time progress tracking system allowing article trainees to update task completion percentages (0-100%) with remarks and enabling Admin to monitor progress through visual dashboards',
    'Implement a leave management module with digital application, approval/rejection workflows, leave balance tracking, and automatic attendance record updates',
    'Build comprehensive reporting and analytics dashboards using Chart.js for attendance trends, performance comparisons, task distribution, and exportable reports (PDF/CSV)',
    'Implement a notification system using Nodemailer (email) and Firebase Cloud Messaging (push notifications) for task assignments, deadline reminders, leave approvals, and attendance alerts',
    'Enable secure user authentication with JWT tokens, bcrypt password hashing (10 salt rounds), role-based access control (RBAC), and session management with configurable timeout',
    'Design the system architecture for future extensibility including AI-based performance analysis (scikit-learn/TensorFlow) and a React Native mobile application',
]
for obj in objectives:
    doc.add_paragraph(f'- {obj}', style='List Bullet')

# ============================================================
# 6. SCOPE OF WORK
# ============================================================
doc.add_heading('6. Scope of Work', level=2)
doc.add_paragraph(
    'The scope of this project includes requirement analysis, system design, development, testing, '
    'deployment, and documentation of the CA Firm Attendance and Article Management System. '
    'The project is divided into the following phases:'
)
scope_items = [
    'Phase 1 — Core System Development: User authentication (Admin and Article roles), article trainee management (CRUD), biometric face recognition attendance, GPS-based attendance verification with geofencing, task assignment and management, progress tracking, leave management, reporting and analytics, and notification system',
    'Phase 2 — Advanced Features (Future): AI-based performance analysis using machine learning for productivity prediction, performance scoring (0-100), trend analysis, and automated recommendations; React Native mobile application for iOS and Android with native camera and GPS integration, push notifications, and offline mode support',
    'Phase 3 — Enterprise Features (Future): Multi-tenant deployment architecture for serving multiple CA firms, third-party HR and accounting software integration, WebSocket-based real-time notifications and live progress updates, and ICAI compliance requirements for article trainee record-keeping',
    'Frontend Development: React.js 18+ Single Page Application with responsive design for desktop and mobile browsers, React Router DOM for navigation, Chart.js for data visualization, face-api.js for browser-based face recognition, and Axios for API communication',
    'Backend Development: Node.js v16+ with Express.js 4.x RESTful API server, Sequelize/mysql2 ORM for MySQL database interaction, JWT authentication, bcrypt password hashing, express-validator for input validation, Multer for file uploads, Nodemailer for email, and Firebase Admin SDK for push notifications',
    'Database Design: MySQL 8.0+ relational database with 9 core tables (admins, articles, attendance, tasks, task_assignments, progress_log, leave_requests, notifications, settings) with proper referential integrity and foreign key constraints',
    'Face Recognition Microservice: Python-based service using face-api.js/OpenCV for biometric attendance verification with face descriptor extraction, comparison, and confidence scoring',
    'Testing and Deployment: Application testing, deployment on cloud infrastructure (AWS/Google Cloud/Render.com), and comprehensive project documentation including SRS, SOW, user manuals, and API documentation',
]
for s in scope_items:
    doc.add_paragraph(f'- {s}', style='List Bullet')

# ============================================================
# 7. DELIVERABLES
# ============================================================
doc.add_heading('7. Deliverables', level=2)
deliverables = [
    'Software Requirement Specification (SRS) document (IEEE 830 format)',
    'Statement of Work (SOW) document',
    'System Design Documents (architecture diagrams, database schema, data flow diagrams, API specification)',
    'Fully functional web application (React.js frontend + Express.js backend + Python face recognition service)',
    'MySQL database with complete relational schema and referential integrity',
    'Face recognition module with trained face descriptor storage and comparison',
    'Admin Dashboard with attendance monitoring, task management, progress tracking, leave management, and analytics',
    'Article Trainee Portal with attendance marking (face + GPS), task viewing, progress updates, and leave application',
    'Automated reporting system with exportable reports in PDF and CSV formats',
    'Notification system (in-app + email + push notifications)',
    'User manual for Admin operations and Article trainee guide',
    'Setup, deployment, and API documentation',
    'Test reports and project blackbook',
]
for d in deliverables:
    doc.add_paragraph(f'- {d}', style='List Bullet')

# ============================================================
# 8. STAKEHOLDERS
# ============================================================
doc.add_heading('8. Stakeholders', level=2)
stakeholders = [
    'SPCM (CA Firm) \u2014 Sponsor organization; primary beneficiary and end-user of the system for managing article trainees',
    'Admin / Chartered Accountant \u2014 Firm partner with full system control; manages articles, assigns tasks, monitors attendance and progress, generates reports',
    'Article Trainees \u2014 CA articled trainees who mark attendance, view assigned tasks, update progress, and apply for leave through the platform',
    'Project Guide (Prof. Disha Wankhede) \u2014 Academic guide providing mentorship, evaluation, and project oversight',
    'Development Team (Group E-17) \u2014 Nivesh Jain, Harsh Nayak, Rachit Ingole, Hasan Rupawalla (B.Tech Computer Engineering, VIT Pune)',
    'Department of Computer Engineering, VIT Pune \u2014 Academic institution overseeing the project as a Major Project for AY 2025-2026',
    'ICAI (Institute of Chartered Accountants of India) \u2014 Regulatory body whose compliance standards may influence system requirements for article trainee record-keeping',
]
for s in stakeholders:
    doc.add_paragraph(f'- {s}', style='List Bullet')

# ============================================================
# 9. ASSUMPTIONS AND CONSTRAINTS
# ============================================================
doc.add_heading('9. Assumptions and Constraints', level=2)

p_assumptions = doc.add_paragraph()
run = p_assumptions.add_run('Assumptions:')
run.bold = True

assumptions = [
    'Users (Admin and Article Trainees) have access to internet-enabled devices with modern web browsers (Chrome, Edge, Firefox, Safari).',
    'Article trainees\' devices have a front-facing camera (minimum 720p) for face recognition attendance.',
    'Browsers support the Geolocation API and users grant location permission for GPS-based attendance verification.',
    'SPCM office location GPS coordinates are preconfigured in the system for geofencing.',
    'Admin (Chartered Accountant) has basic computer literacy to operate the dashboard and management panels.',
    'All article trainees are registered by Admin and their face descriptors are captured during onboarding before they can use the attendance system.',
    'Stable internet connectivity (minimum 1 Mbps) is available at the office and for remote access.',
    'The MySQL database server (local or cloud-hosted) is available and accessible with proper backups.',
    'HTTPS is available on the deployment server (mandatory for browser camera and GPS API access).',
]
for a in assumptions:
    doc.add_paragraph(f'- {a}', style='List Bullet')

p_constraints = doc.add_paragraph()
run = p_constraints.add_run('Constraints:')
run.bold = True

constraints = [
    'Project timeline is limited to the academic year 2025\u20132026.',
    'The system is initially designed for a single CA firm (SPCM); multi-tenant support is planned for future phases.',
    'Face recognition accuracy depends on lighting conditions, camera quality, and the initial face descriptor registration quality.',
    'GPS accuracy may vary based on device hardware and environmental factors (indoor vs. outdoor, urban canyons).',
    'Attendance can be marked only once per day per article trainee to prevent duplicate records.',
    'HTTPS is mandatory for camera and Geolocation API access in all modern browsers, requiring SSL certificate deployment.',
    'AI-based performance analysis and mobile application are planned as future enhancements and are not part of the current development phase.',
    'All biometric data (face descriptors) must be stored securely with encryption to comply with data protection best practices.',
    'Budget is limited to the academic project scope; cloud infrastructure costs must be minimized using free-tier or institutional resources.',
]
for c in constraints:
    doc.add_paragraph(f'- {c}', style='List Bullet')

# ============================================================
# 10. CONCLUSION
# ============================================================
doc.add_heading('10. Conclusion', level=2)
doc.add_paragraph(
    'This Statement of Work outlines the vision, goals, and objectives of developing the CA Firm '
    'Attendance and Article Management System for SPCM. The project addresses critical operational '
    'challenges faced by Chartered Accountant firms in managing article trainees by replacing manual, '
    'paper-based workflows with a comprehensive, secure, and intelligent digital platform. Through '
    'biometric face recognition and GPS-based attendance verification, structured task assignment and '
    'real-time progress tracking, automated leave management, and data-driven reporting and analytics, '
    'the system aims to significantly enhance productivity, transparency, and accountability within the '
    'firm. With a robust architecture designed for future extensibility \u2014 including AI-powered performance '
    'analysis and a dedicated mobile application \u2014 the platform positions SPCM to embrace digital '
    'transformation in article trainee management, setting a benchmark for modern CA firm operations.'
)

# Save
doc.save('SOW_CA_Firm_Attendance.docx')
print('SOW document created successfully: SOW_CA_Firm_Attendance.docx')
