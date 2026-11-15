import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { Event } from "../models/event.model.js";
import { School } from "../models/school.model.js";
import { Hospital } from "../models/hospital.model.js";
import { Hotel } from "../models/hotel.model.js";
import { Mall } from "../models/mall.model.js";
import { Garden } from "../models/garden.model.js";
import { BanquetHall } from "../models/banquethall.model.js";
import { ParkingBuilding } from "../models/parkingbuilding.model.js";
import PathInfo from "../models/pathinfo.model.js";
import RouteSegmentLog from "../models/routeSegmentLog.model.js";
import Predicted from "../models/predicted.model.js";
import PredictionLog from "../models/predictionLog.model.js";

await mongoose.connect(process.env.MONGODB_URI);

const counts = {
  events: await Event.countDocuments(),
  schools: await School.countDocuments(),
  hospitals: await Hospital.countDocuments(),
  hotels: await Hotel.countDocuments(),
  malls: await Mall.countDocuments(),
  gardens: await Garden.countDocuments(),
  banquetHalls: await BanquetHall.countDocuments(),
  parkingBuildings: await ParkingBuilding.countDocuments(),
  pathInfo: await PathInfo.countDocuments(),
  routeSegmentLogs: await RouteSegmentLog.countDocuments(),
  predicted: await Predicted.countDocuments(),
  predictionLogs: await PredictionLog.countDocuments(),
};

// Check latest PathInfo date
const latestPathInfo = await PathInfo.findOne({}).sort({ date: -1 }).lean();
const earliestPathInfo = await PathInfo.findOne({}).sort({ date: 1 }).lean();

console.log("=== COLLECTION COUNTS ===");
for (const [key, val] of Object.entries(counts)) {
  console.log(`${key.padEnd(20)}: ${val}`);
}
console.log("\n=== PATHINFO DATE RANGE ===");
console.log("Earliest:", earliestPathInfo?.date);
console.log("Latest  :", latestPathInfo?.date);

// Check per-route coverage
const routes = await PathInfo.distinct("pathId");
console.log("\n=== ROUTES IN PATHINFO ===");
for (const route of routes) {
  const count = await PathInfo.countDocuments({ pathId: route });
  const latest = await PathInfo.findOne({ pathId: route }).sort({ date: -1 }).lean();
  console.log(`${route.padEnd(30)}: ${count} records, latest: ${latest?.date?.toDateString()}`);
}

await mongoose.disconnect();
