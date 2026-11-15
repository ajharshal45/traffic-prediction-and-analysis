import dns from "dns";
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { BMSEvent } from "../models/bms_event.model.js";

await mongoose.connect(process.env.MONGODB_URI);
const all = await BMSEvent.find({}).sort({ startTime: 1 }).lean();
console.log(`Total BMS Events: ${all.length}\n`);
for (const e of all) {
  console.log(`[${e._id}] "${e.name}" | Start: ${e.startTime} | Loc: ${e.locationStr}`);
}
await mongoose.disconnect();
