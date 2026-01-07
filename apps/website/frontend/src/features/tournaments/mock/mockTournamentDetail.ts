import type { TournamentDetail } from "../types";

export const mockTournamentDetail: TournamentDetail = {
    id: "102",
    name: "Southeast Regional Championship",
    status: "LIVE",
    levels: ["MS", "HS"],
    location_city: "Atlanta",
    location_state: "GA",
    start_date: "2024-09-28",
    end_date: "2024-09-28",
    set: {
        difficulty: "HS Regionals",
        writers: "US Department of Energy",
    },
    website_url: "https://example.com/southeast-regional",
    contacts: [
        { name: "Jordan Lee", email: "jordan.lee@example.com", phone: "(404) 555-0123" },
        { name: "Priya Nair", email: "priya.nair@example.com" },
    ],
    logistics:
        "Check-in opens at 7:15 AM in the main lobby. Opening meeting begins at 8:00 AM sharp. Teams should bring printed rosters and a signed photo release form. Parking is available in the visitor deck; overflow parking is across the street at the student lot.",
    registration: {
        method: "FORM",
        instructions:
            "Complete the registration form and upload your roster. If your school is sending multiple teams, submit one form per team.\n\nYou will receive a confirmation email within 48 hours with payment details and day-of logistics.",
        url: "https://example.com/southeast-regional/register",
        deadlines: [
            { label: "Early registration", date: "2024-08-30" },
            { label: "Final roster deadline", date: "2024-09-20" },
        ],
        cost: "$120 per team (waivers available)",
    },
    format: {
        summary: "4 pools of 4 round robin prelims → 8-team single-elim playoffs",
        phases: [
            { name: "Prelims", description: "4 pools of 4 round robin (4 rounds)" },
            { name: "Playoffs", description: "Top 2 per pool advance to 8-team bracket" },
            { name: "Finals", description: "Single-game championship match" },
        ],
        rounds: 7,
        field_limit: 16,
    },
    field_limit: 16,
    teams: [
        {
            id: "t-1",
            team_name: "Northview A",
            school_name: "Northview High School",
            city: "Johns Creek",
            state: "GA",
            level: "HS",
            status: "CONFIRMED",
            roster: [
                { name: "Avery Kim", role: "Captain", grade: 11 },
                { name: "Noah Patel", role: "Player", grade: 12 },
                { name: "Sofia Martinez", role: "Player", grade: 10 },
                { name: "Ethan Brooks", role: "Player", grade: 11 },
                { name: "Coach D. Harper", role: "Coach" },
            ],
        },
        { id: "t-2", team_name: "Northview B", school_name: "Northview High School", city: "Johns Creek", state: "GA", level: "HS", status: "CONFIRMED" },
        {
            id: "t-3",
            team_name: "Lambert A",
            school_name: "Lambert High School",
            city: "Suwanee",
            state: "GA",
            level: "HS",
            status: "CONFIRMED",
        },
        { id: "t-4", team_name: "Chattahoochee A", school_name: "Chattahoochee High School", city: "Alpharetta", state: "GA", level: "HS", status: "CONFIRMED" },
        {
            id: "t-5",
            team_name: "Riverwood A",
            school_name: "Riverwood International Charter School",
            city: "Sandy Springs",
            state: "GA",
            level: "HS",
            status: "WAITLIST",
            roster: [
                { name: "Maya Singh", role: "Captain", grade: 12 },
                { name: "Liam Chen", role: "Player", grade: 11 },
                { name: "Elena Rossi", role: "Player", grade: 10 },
                { name: "Coach S. Park", role: "Coach" },
            ],
        },
        { id: "t-6", team_name: "Milton A", school_name: "Milton High School", city: "Milton", state: "GA", level: "HS", status: "CONFIRMED" },
        { id: "t-7", team_name: "Brookwood A", school_name: "Brookwood High School", city: "Snellville", state: "GA", level: "HS", status: "CONFIRMED" },
        { id: "t-8", team_name: "Walton A", school_name: "Walton High School", city: "Marietta", state: "GA", level: "HS", status: "CONFIRMED" },
        { id: "t-9", team_name: "Fulton MS A", school_name: "Fulton Science Magnet", city: "Atlanta", state: "GA", level: "MS", status: "CONFIRMED" },
        { id: "t-10", team_name: "Fulton MS B", school_name: "Fulton Science Magnet", city: "Atlanta", state: "GA", level: "MS", status: "WAITLIST" },
        { id: "t-11", team_name: "Decatur MS A", school_name: "Decatur Middle School", city: "Decatur", state: "GA", level: "MS", status: "CONFIRMED" },
        {
            id: "t-12",
            team_name: "Pinecrest MS A",
            school_name: "Pinecrest Academy",
            city: "Cumming",
            state: "GA",
            level: "MS",
            status: "CONFIRMED",
            roster: [
                { name: "Olivia Zhao", role: "Captain", grade: 8 },
                { name: "Jackson Reed", role: "Player", grade: 8 },
                { name: "Emma Johnson", role: "Player", grade: 7 },
                { name: "Coach K. Alvarez", role: "Coach" },
            ],
        },
        { id: "t-13", team_name: "Pinecrest MS B", school_name: "Pinecrest Academy", city: "Cumming", state: "GA", level: "MS", status: "WAITLIST" },
        { id: "t-14", team_name: "Gwinnett MS A", school_name: "Gwinnett STEM Academy", city: "Lawrenceville", state: "GA", level: "MS", status: "CONFIRMED" },
        { id: "t-15", team_name: "Gwinnett MS B", school_name: "Gwinnett STEM Academy", city: "Lawrenceville", state: "GA", level: "MS", status: "CONFIRMED" },
        { id: "t-16", team_name: "Oconee HS A", school_name: "Oconee County High School", city: "Watkinsville", state: "GA", level: "HS", status: "CONFIRMED" },
        { id: "t-17", team_name: "Savannah HS A", school_name: "Savannah Arts Academy", city: "Savannah", state: "GA", level: "HS", status: "DROPPED" },
        { id: "t-18", team_name: "Columbus HS A", school_name: "Columbus High School", city: "Columbus", state: "GA", level: "HS", status: "WAITLIST" },
    ],
    updated_at: "2024-09-28T14:05:00Z",
};

export async function getTournamentById(id: string): Promise<TournamentDetail | null> {
    // TODO(API): Replace this with a real API call; keep the return shape stable.
    if (id === mockTournamentDetail.id) return mockTournamentDetail;
    return null;
}

