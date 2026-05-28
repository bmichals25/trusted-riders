import { type RideChatMessage, type RideChatStatus } from "./chat-api";
import { type DispatchedRide } from "./rides";

const now = Date.now();

export const demoRides: DispatchedRide[] = [
  {
    id: "1027",
    passengerName: "Marisol Vega",
    passengerPhotoUrl: "",
    pickupAddress: "Northside Medical Center, 980 Johnson Ferry Rd NE",
    dropoffAddress: "Lenox Village Dialysis, 3379 Peachtree Rd NE",
    pickupCoords: { latitude: 33.9087, longitude: -84.3514 },
    dropoffCoords: { latitude: 33.8462, longitude: -84.3661 },
    routeCoords: [
      { latitude: 33.9087, longitude: -84.3514 },
      { latitude: 33.8931, longitude: -84.3542 },
      { latitude: 33.8752, longitude: -84.3609 },
      { latitude: 33.8588, longitude: -84.3648 },
      { latitude: 33.8462, longitude: -84.3661 },
    ],
    scheduledDate: "Today",
    scheduledTime: "10:45 AM",
    transitType: "Wheelchair",
    tripType: "One-Way",
    notes: "Patient uses a folding wheelchair. Please call on arrival and meet at entrance B.",
    emergencyContact: "Elena Vega, +1 (404) 555-0198",
    status: "pending",
    createdAt: now - 16 * 60_000,
  },
  {
    id: "1024",
    passengerName: "Arthur Bennett",
    passengerPhotoUrl: "",
    pickupAddress: "The Georgian Lakeside, 1100 Glenridge Dr",
    dropoffAddress: "Piedmont Atlanta Hospital, 1968 Peachtree Rd NW",
    pickupCoords: { latitude: 33.9183, longitude: -84.3634 },
    dropoffCoords: { latitude: 33.8095, longitude: -84.3956 },
    routeCoords: [
      { latitude: 33.9183, longitude: -84.3634 },
      { latitude: 33.8895, longitude: -84.3712 },
      { latitude: 33.8582, longitude: -84.386 },
      { latitude: 33.8296, longitude: -84.3941 },
      { latitude: 33.8095, longitude: -84.3956 },
    ],
    scheduledDate: "Today",
    scheduledTime: "9:10 AM",
    transitType: "Ambulatory",
    tripType: "Round-Trip",
    notes: "Dispatch confirmed spouse is riding along. Use north lobby pickup lane.",
    emergencyContact: "Maya Bennett, +1 (678) 555-0144",
    status: "en_route",
    createdAt: now - 68 * 60_000,
  },
  {
    id: "1031",
    passengerName: "Denise Holloway",
    passengerPhotoUrl: "",
    pickupAddress: "Emory Clinic, 1365 Clifton Rd",
    dropoffAddress: "Oak Grove Rehabilitation, 3145 Lavista Rd",
    pickupCoords: { latitude: 33.7904, longitude: -84.3217 },
    dropoffCoords: { latitude: 33.8328, longitude: -84.2638 },
    routeCoords: [
      { latitude: 33.7904, longitude: -84.3217 },
      { latitude: 33.8025, longitude: -84.3074 },
      { latitude: 33.8166, longitude: -84.2867 },
      { latitude: 33.8328, longitude: -84.2638 },
    ],
    scheduledDate: "Today",
    scheduledTime: "2:30 PM",
    transitType: "Sedan",
    tripType: "One-Way",
    notes: "Ready at outpatient discharge desk. Bring small bag from nurse station.",
    emergencyContact: "Corey Holloway, +1 (770) 555-0173",
    status: "accepted",
    createdAt: now - 36 * 60_000,
  },
  {
    id: "1038",
    passengerName: "Lillian Park",
    passengerPhotoUrl: "",
    pickupAddress: "Brookhaven Family Practice, 3929 Peachtree Rd",
    dropoffAddress: "Sunrise at Buckhead, 1000 Lenox Park Blvd",
    pickupCoords: { latitude: 33.8603, longitude: -84.3396 },
    dropoffCoords: { latitude: 33.8479, longitude: -84.3472 },
    routeCoords: [
      { latitude: 33.8603, longitude: -84.3396 },
      { latitude: 33.8551, longitude: -84.3421 },
      { latitude: 33.8479, longitude: -84.3472 },
    ],
    scheduledDate: "Tomorrow",
    scheduledTime: "8:15 AM",
    transitType: "Wheelchair",
    tripType: "One-Way",
    notes: "Early pickup. Facility asks for driver to check in at reception.",
    emergencyContact: "Jin Park, +1 (470) 555-0186",
    status: "accepted",
    createdAt: now - 22 * 60_000,
  },
];

export function demoChatMessages(rideId: string): RideChatMessage[] {
  const ride = demoRides.find((item) => item.id === rideId) ?? demoRides[1];
  return [
    {
      id: `${ride.id}-m1`,
      ride_id: ride.id,
      text: `Dispatch assigned ride #${ride.id}. Please confirm when you are en route.`,
      sender: "dispatch",
      sender_name: "Dispatch",
      client_message_id: null,
      metadata: {},
      created_at: new Date(now - 18 * 60_000).toISOString(),
    },
    {
      id: `${ride.id}-m2`,
      ride_id: ride.id,
      text: "Confirmed. I am heading to pickup now.",
      sender: "driver",
      sender_name: "Jordan",
      client_message_id: null,
      metadata: {},
      created_at: new Date(now - 15 * 60_000).toISOString(),
    },
    {
      id: `${ride.id}-m3`,
      ride_id: ride.id,
      text: `${ride.passengerName.split(" ")[0]} is ready at the listed pickup entrance. Notes are current.`,
      sender: "dispatch",
      sender_name: "Dispatch",
      client_message_id: null,
      metadata: {},
      created_at: new Date(now - 7 * 60_000).toISOString(),
    },
  ];
}

export function demoChatStatus(rideId: string): RideChatStatus {
  return {
    ride_id: rideId,
    typing: [],
    read_receipts: {
      dispatch: {
        sender: "dispatch",
        sender_name: "Dispatch",
        last_read_message_id: `${rideId}-m2`,
        read_at: new Date(now - 12 * 60_000).toISOString(),
      },
    },
  };
}

