import axios from "axios";
import FormData from "form-data"; 
import { Image } from "../models/image.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import fs from "fs";
import { User } from "../models/user.model.js";


// CRITICAL FIX: Use the environment variable instead of the hardcoded URL
const FLASK_URL = process.env.FLASK_ML_SERVICE_URL;

// Warn at startup if the variable is missing so the problem is obvious in logs
if (!FLASK_URL) {
  console.warn(
    '⚠️  [model.controller] FLASK_ML_SERVICE_URL is not set in .env. ' +
    'The pothole-detection endpoint (/api/model/predict) will return 503 ' +
    'until the Flask ML service is running and the variable is configured.'
  );
}

export const getPrediction = async (req, res) => {
  try {
    const { lng, lat } = req.body;

    // Assuming authentication middleware attaches the user ID to the request
    const userId = req.userId;

    const uploadedImage = req.file;

    if (!uploadedImage) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const filePath = uploadedImage.path;

    // Guard: Flask service URL must be configured
    if (!FLASK_URL) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(503).json({
        error: 'ML service unavailable',
        detail:
          'The pothole detection service (Flask) is not configured. ' +
          'Set FLASK_ML_SERVICE_URL in the backend .env file and restart the server.',
      });
    }

    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    let flaskResponse;
    try {
      // Use the FLASK_URL environment variable
      flaskResponse = await axios.post(`${FLASK_URL}/predict`, formData, {
        headers: { ...formData.getHeaders() },
        timeout: 15000, // 15s — don't hang forever if Flask is down
      });
    } catch (flaskErr) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      console.error('Flask ML service error:', flaskErr.message);
      return res.status(503).json({
        error: 'ML service unavailable',
        detail:
          `Could not reach the pothole detection service at ${FLASK_URL}. ` +
          'Make sure the Flask server is running.',
      });
    }

    const prediction = flaskResponse.data.prediction;

    if (prediction === 'pothole') {

      const cloudurl = await uploadOnCloudinary(uploadedImage.path);

      await User.updateOne(
        { _id: userId }, 
        { $inc: { citizen_score: 50 } }
      );

      console.log("the url which we want:", cloudurl.secure_url);

      const newImage = new Image({
        src: cloudurl.secure_url, 
        user: userId,
        longitude: lng, 
        latitude: lat, 
      });

      const savedImage = await newImage.save();

      res.json({
        message: "Image uploaded and saved successfully",
        prediction: prediction,
      });
      
    } else {
      // Clean up the temporary file if no pothole was detected
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      res.json({
        message: "Prediction is not 'pothole', image not saved",
        prediction: prediction,
      });
    }

  } catch (error) {
    console.error("Error processing the image:", error);
    // Clean up the temporary file in case of any failure
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Error processing image and prediction' });
  }
};


export const getPotholeDatamodel = async (req, res) => {
    try {
        const images = await Image.find({});
        res.json(images);

    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error fetching pothole images' });
    }
  };

export const resolvePothole = async (req, res) => {
  try {
    const { id } = req.params;
    await Image.findByIdAndUpdate(id, { isresolved: true });
    res.status(200).json({ message: 'Pothole resolved successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error resolving pothole' });
  }
};