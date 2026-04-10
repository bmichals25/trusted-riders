export const activeMission = {
  name: "Eleanor Rigby",
  pickup: "123 Penny Lane",
  dropoff: "City Medical Center",
  time: "14:00",
  notes:
    "Requires steady arm assistance during boarding. Vision impaired in left eye. Prefers a quiet cabin environment and low fragrance inside the vehicle.",
  emergencyContact: "Father McKenzie (555-0199)",
  type: "Wheelchair Round-Trip",
  memberSince: "July 2021",
  age: "72 Years",
  transit: "Wheelchair / Van",
  eta: "4m",
};

export const scheduledRides = [
  {
    id: "#8829",
    time: "16:45",
    name: "Sarah Jenkins",
    type: "Physical Therapy",
    vehicle: "Sedan",
  },
  {
    id: "#8830",
    time: "17:20",
    name: "Martin Lewis",
    type: "Cardiology Follow-Up",
    vehicle: "Wheelchair",
  },
];

export const pastRides = [
  "William Chen",
  "Andrea Torres",
  "Maya Thompson",
  "Jerome Patel",
];

export const routeSteps = [
  {
    title: "Head North on Penny Lane",
    subtitle: "Continue for 0.4 miles",
    accent: "next",
  },
  {
    title: "Turn Right onto Abbey Road",
    subtitle: "Entrance to bypass after 1.2 miles",
    accent: "default",
  },
  {
    title: "Take Exit 42 (City Med)",
    subtitle: "Keep left at the fork",
    accent: "default",
  },
];
