import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { BMSEvent } from "../models/bms_event.model.js";

await mongoose.connect(process.env.MONGODB_URI);

// Delete all events that started before Nov 2026
const cutoff = new Date("2026-11-01T00:00:00.000Z");
const result = await BMSEvent.deleteMany({ startTime: { $lt: cutoff } });
console.log(`Deleted ${result.deletedCount} outdated BMS events (before Nov 2026)`);

const remaining = await BMSEvent.find({}).sort({ startTime: 1 }).lean();
console.log(`\nRemaining BMS Events: ${remaining.length}`);
for (const e of remaining) {
  console.log(`  ✅ "${e.name}" | Start: ${e.startTime.toDateString()} | ${e.locationStr}`);
}

await mongoose.disconnect();
