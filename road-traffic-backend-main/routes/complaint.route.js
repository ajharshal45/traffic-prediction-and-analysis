import express from 'express';
import { registerComplaint, getComplaintDatamodel, resolveComplaint } from '../controllers/complaint.controller.js'; // Import your controller function for handling registration
import { upload } from '../middlewares/multer.middleware.js';
import { verifyToken } from '../middlewares/verifyToken.js';

const router = express.Router();

// Define the route for user registration
router.post('/',upload.single('image'),registerComplaint); // Assuming your registration handler is named `registerUser`
router.get('/getComplaintData',getComplaintDatamodel); 
router.put('/:id/resolve', resolveComplaint);
export default router;
