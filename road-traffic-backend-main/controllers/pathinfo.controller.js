import PathInfo from '../models/pathinfo.model.js';
import { Diversion } from "../models/diversion.model.js";
import { Construction } from "../models/construction.model.js";
import { hotspotLocation } from '../models/nearbyHotspot.model.js' 
import { Event } from '../models/event.model.js';
import axios from 'axios'; 

// --- ❌ REMOVED: WEATHER HELPER FUNCTIONS (Moved to predictTraffic.controller.js) ---
/*
const mapWmoCodeToScore = (code) => { ... }; 
const getWeatherScore = async (lat, lng, date) => { ... }; 
*/

// --- ❌ REMOVED: DISTANCE HELPER (Moved to predictTraffic.controller.js) ---
/*
const calculateDistance = (point1, point2) => { ... };
*/


// --- EXISTING PATHINFO CONTROLLERS (Data Management Functions) ---

export const addPathInfo = async (req, res) => {
  try {
    const { pathId, timeRange,score, level } = req.body;
    let date = new Date(req.body.date);
    date = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
    console.log(date);
    console.log("score is --",score);
    if (!pathId || !timeRange || !date || score == null || !level) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const formattedDate = new Date(date);
    formattedDate.setHours(0,0,0,0);
    
    const existingEntries = await PathInfo.find({ pathId, timeRange, date: date });

    if (existingEntries.length === 0 && score!=0 ) {
      const newPathInfo = new PathInfo({
        pathId,
        timeRange,
        date: date,
        score,
        level,
      });
      await newPathInfo.save();
      return res.status(201).json({ message: 'Path info added successfully.', data: newPathInfo });
    } else {
      const totalScore = existingEntries.reduce((sum, entry) => sum + entry.score, 0) + score;
      const newScore = totalScore / (existingEntries.length + 1);
      await PathInfo.updateMany(
        { pathId, timeRange, date: formattedDate },
        { $set: { score: newScore, level } }
      );
      return res.status(200).json({
        message: 'Existing path info updated with average score.',
        data: { pathId, timeRange, date: formattedDate, score: newScore, level },
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};


export const getCalendarData = async (req, res) => {
  try {
    const { pathId, timeRange } = req.query;

    if (!pathId || !timeRange) {
      return res.status(400).json({ message: 'Path ID and Time Range are required.' });
    }

    const data = await PathInfo.find({ pathId, timeRange });

    // Normalize dates to remove time offsets
    const normalizedData = data.map((entry) => ({
      ...entry._doc,
      date: new Date(entry.date).toISOString().split('T')[0], // Return only the date part in ISO format
    }));

    res.status(200).json(normalizedData);
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};


export const getFestivalData = async (req, res) => {
  try {
    const { pathId, timeRange, dates } = req.query;

    if (!pathId || !timeRange || !dates) {
      return res.status(400).json({ message: 'Missing required query parameters: pathId, timeRange, or dates' });
    }

    // Parse the dates array from the query 
    let parsedDates = [];
    try {
      parsedDates = JSON.parse(dates); 
    } catch (error) {
      return res.status(400).json({ message: 'Invalid dates array format' });
    }

    // Check if parsedDates is an array and has values
    if (!Array.isArray(parsedDates) || parsedDates.length === 0) {
      return res.status(400).json({ message: 'Invalid or empty dates array' });
    }

    // Normalize the dates by removing the time part 
    const normalizedDates = parsedDates.map(date => new Date(date).toISOString().slice(0, 10)); 
    
    // Query the database
    const results = await PathInfo.find({
      pathId,
      timeRange,
    });

    // Process results to compare only the date part 
    const response = results.filter(record => {
      const recordDate = new Date(record.date).toISOString().slice(0, 10); // Normalize the date from the database
      return normalizedDates.includes(recordDate);  // Compare only the date part
    }).map(record => ({
      year: new Date(record.date).getFullYear(),
      score: record.score,
    }));

    // Send the processed response
    if (response.length === 0) {
      return res.status(404).json({ message: 'No data found for the provided criteria' });
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching festival data:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getLastFourWeekDayData = async (req, res) => {
    try {
      const { path, timeRange, day } = req.query;

      if (!path || !timeRange || day === undefined) {
        return res.status(400).json({ message: 'Path ID, Time Range, and Day are required.' });
      }

      const selectedDay = parseInt(day);
      if (isNaN(selectedDay) || selectedDay < 0 || selectedDay > 6) {
        return res.status(400).json({ message: 'Invalid day value. It must be between 0 (Sunday) and 6 (Saturday).' });
      }

      // Adjust to ensure consistent timezone handling (IST to UTC conversion)
      let today = new Date();
      today = new Date(today.getTime() + 5.5 * 60 * 60 * 1000); // Convert to IST

      const data = [];
      let currentDate = new Date(today);
      let weekdaysFound = 0;

      while (weekdaysFound < 4) {
        currentDate.setDate(currentDate.getDate() - 1); // Move to the previous day
        
        if (currentDate.getDay() === selectedDay) {
          // Create a date range for the selected day (ignore time)
          const startOfDay = new Date(currentDate);
          startOfDay.setHours(0, 0, 0, 0);

          const endOfDay = new Date(currentDate);
          endOfDay.setHours(23, 59, 59, 999);

          console.log("Query Date Range:", startOfDay.toISOString(), "to", endOfDay.toISOString());

          // Fetch data using the date range (ignoring time)
          const entries = await PathInfo.find({
            pathId: path,
            timeRange,
            date: { $gte: startOfDay, $lt: endOfDay }, // Compare only date range
          });

          console.log("Entries Found:", entries);

          if (entries.length > 0) {
            data.push({
              date: startOfDay.toISOString().split('T')[0], // Format as YYYY-MM-DD
              score: entries[0].score, // Assuming one record per day, adjust if necessary
            });
          }

          weekdaysFound += 1;
        }
      }

      // Sort data by date (ascending)
      data.sort((a, b) => new Date(a.date) - new Date(b.date));

      res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching last four weekday data:', error);
      res.status(500).json({ message: 'Server error. Please try again later.', error: error.message });
    }
  };