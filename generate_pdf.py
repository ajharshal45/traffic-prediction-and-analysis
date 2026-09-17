from fpdf import FPDF

class PDF(FPDF):
    def header(self):
        self.set_font('helvetica', 'B', 15)
        self.cell(0, 10, 'Traffic Prediction and Analysis System - Execution Steps', 0, 1, 'C')
        self.ln(5)

    def chapter_title(self, title):
        self.set_font('helvetica', 'B', 12)
        self.set_fill_color(200, 220, 255)
        self.cell(0, 10, title, 0, 1, 'L', 1)
        self.ln(4)

    def chapter_body(self, body):
        self.set_font('helvetica', '', 11)
        self.multi_cell(0, 7, body)
        self.ln()

pdf = PDF()
pdf.add_page()

pdf.chapter_title('Prerequisites')
pdf.chapter_body(
    "1. Node.js: Ensure Node.js (v18 or higher) is installed.\n"
    "2. Python: Ensure Python (v3.8 or higher) is installed.\n"
    "3. MongoDB: Ensure MongoDB is running or you have a valid MongoDB connection URI."
)

pdf.chapter_title('1. Backend Setup (Node.js)')
pdf.chapter_body(
    "1. Open a terminal and navigate to the backend directory: `cd road-traffic-backend-main`\n"
    "2. Install the required Node.js dependencies: `npm install`\n"
    "3. Set up the environment variables:\n"
    "   - Create a `.env` file in the `road-traffic-backend-main` directory.\n"
    "   - Add your connection string and variables: `PORT=4000`, `MONGODB_URI=your_uri`\n"
    "4. Start the Node.js backend server: `npm start`\n"
    "   The backend server will run on http://localhost:4000."
)

pdf.chapter_title('2. Pothole Detection Model Setup (Python/Flask)')
pdf.chapter_body(
    "1. Open a new terminal and navigate to the pothole model directory: `cd road-traffic-backend-main/pothole-model`\n"
    "2. Install the required Python dependencies: `pip install flask flask-cors tensorflow pillow numpy`\n"
    "3. Start the Flask server: `python app.py`\n"
    "   The pothole detection model will be accessible at http://localhost:3003."
)

pdf.chapter_title('3. Frontend Setup (React/Vite)')
pdf.chapter_body(
    "1. Open a new terminal and navigate to the frontend directory: `cd road-traffic-frontend-main`\n"
    "2. Install the required Node.js dependencies: `npm install`\n"
    "3. Start the Vite development server: `npm run dev`\n"
    "4. Open your web browser and navigate to the URL provided by Vite (typically http://localhost:5173)."
)

pdf.chapter_title('Summary of Running Services')
pdf.chapter_body(
    "- Frontend: http://localhost:5173\n"
    "- Main Backend API: http://localhost:4000\n"
    "- Pothole Detection API: http://localhost:3003\n\n"
    "You can now use the application from the frontend interface!"
)

pdf.output('Execution_Steps.pdf')
