// import fetch from "node-fetch"; // Native fetch is available in Node.js v18+
import festivalDurations from "./festivalDuration.json" with { type: "json" }; // Import durations

// ------------------------------------------------------------
// FESTIVAL IMPACT CATEGORIES FOR MAHARASHTRA
// ------------------------------------------------------------

const HIGH_IMPACT = [
    "ganesh chaturthi",
    "diwali",
    "navratri",
    "maha shivaratri",
    "raksha bandhan",
    "janmashtami",
    "new year",
    "new year's day"
];

const MEDIUM_IMPACT = [
    "dussehra",
    "vijaya dashami",
    "baisakhi",
    "vaisakhi",
    "gudi padwa",
    "pongal",
    "eid al-fitr",
    "eid al-adha",
    "id-ul-zuha",
    "ramzan id",
    "independence day",
    "republic day",
    "holi" 
];

const LOW_IMPACT = [
    "good friday",
    "gandhi jayanti",
    "onam",
    "christmas",
    "christmas day"
];

// ------------------------------------------------------------
// FUNCTION TO GET IMPACT VALUE
// ------------------------------------------------------------
function getFestivalImpact(name) {
    name = name.toLowerCase();

    if (HIGH_IMPACT.includes(name)) return 20;
    if (MEDIUM_IMPACT.includes(name)) return 10;
    if (LOW_IMPACT.includes(name)) return 0;

    return 0;
}

const API_KEY = "kzuAnngcrYJZQc76F6fTIPJdVUmmTTpx";

// ------------------------------------------------------------
// MAIN FUNCTION — FESTIVAL MATCHING
// ------------------------------------------------------------
export const getFestivalForDate = async (selectedDate) => {
    try {
        const year = selectedDate.split("-")[0];

        // Added &country=IN to the URL as it was missing in original snippet but required for Indian festivals
        const url = `https://calendarific.com/api/v2/holidays?api_key=${API_KEY}&country=IN&year=${year}`;
        const res = await fetch(url);
        const json = await res.json();

        const holidays = json?.response?.holidays;
        if (!holidays || !Array.isArray(holidays)) {
            console.log("❌ Invalid Calendarific Response:", json);
            return null;
        }

        const selected = new Date(selectedDate);
        const selectedTime = selected.getTime();

        // LOOP THROUGH ALL HOLIDAYS
        for (let h of holidays) {
            const holidayName = h.name || "";
            const holidayLower = holidayName.toLowerCase();

            // CHECK IMPACT BASED ON HOLIDAY NAME
            const impact = getFestivalImpact(holidayLower);

            if (impact !== 0) {
                const mainDate = h.date.iso;
                const start = new Date(mainDate);

                // Get Duration from JSON (default to 1 day if not found)
                // Match specific keys from JSON to the holiday name
                // Iterate through JSON keys to find partial match or exact match
                let duration = 1;
                for (const [key, days] of Object.entries(festivalDurations)) {
                    if (holidayName.toLowerCase().includes(key.toLowerCase())) {
                        duration = days;
                        break;
                    }
                }

                // Calculate End Date
                const end = new Date(start);
                end.setDate(start.getDate() + (duration - 1));
                end.setHours(23, 59, 59, 999); // ✅ Include the full last day

                // Check if selected date falls within the festival range
                if (selected >= start && selected <= end) {
                    return {
                        festivalName: h.name,
                        impact,
                        duration,
                        mainDate,
                        startDate: start.toISOString().split("T")[0],
                        endDate: end.toISOString().split("T")[0]
                    };
                }
            }
        }

        return null;

    } catch (error) {
        console.error("Festival check failed:", error);
        return null;
    }
};

export { getFestivalImpact };
