export type PaymentChoice = "insurance" | "self" | "later";

export type CoverageStatus = "not_verified" | "requested";

export type Profile = {
  fullName: string;
  phone: string;
  dateOfBirth: string;
  zip: string;
  language: string;
  payment: PaymentChoice;
  onboardingComplete: boolean;
  deferred: boolean;
  insuranceCompany: string;
  memberId: string;
  planName: string;
  cardFrontName: string;
  cardBackName: string;
  coverageStatus: CoverageStatus;
};

export type Preferences = {
  visitType: string;
  location: string;
  preferredTimes: string;
  paymentLabel: string;
};

export type Slot = {
  id: string;
  visitType: string;
  provider: string;
  dateLabel: string;
  longDate: string;
  timeLabel: string;
  endLabel: string;
  duration: string;
  address: string;
  cityLine: string;
  reference: string;
  estimate: string;
  distance: string;
  rating: string;
  period: "morning" | "afternoon";
  startIso: string;
  endIso: string;
};

export type Appointment = Slot & {
  status: "confirmed" | "cancelled";
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
};

export type Notice = {
  id: string;
  title: string;
  body: string;
  read: boolean;
};

export type CareSnapshot = {
  version: 2;
  profile: Profile;
  preferences: Preferences;
  messages: ChatMessage[];
  draft: Slot | null;
  appointment: Appointment | null;
  notices: Notice[];
};

export const visitTypes = [
  "Dental checkup",
  "Eye exam",
  "Annual physical",
  "Dermatology visit",
];

export const timeChoices = [
  "Weekday mornings",
  "Weekday afternoons",
  "Flexible",
];

export const languages = ["English", "Spanish"];

export function paymentLabel(payment: PaymentChoice) {
  if (payment === "insurance") return "Insurance";
  if (payment === "self") return "Self-pay (estimate prices)";
  return "Decide at the visit";
}

export function paymentTitle(payment: PaymentChoice) {
  if (payment === "insurance") return "Use insurance";
  if (payment === "self") return "Self-pay";
  return "Decide later";
}

export function defaultProfile(name = "Maya Chen"): Profile {
  return {
    fullName: name || "Maya Chen",
    phone: "(312) 555-0142",
    dateOfBirth: "07 / 14 / 1990",
    zip: "60614",
    language: "English",
    payment: "self",
    onboardingComplete: false,
    deferred: false,
    insuranceCompany: "Example Health",
    memberId: "4812",
    planName: "Example PPO",
    cardFrontName: "",
    cardBackName: "",
    coverageStatus: "not_verified",
  };
}

export function defaultPreferences(): Preferences {
  return {
    visitType: "Dental checkup",
    location: "Near 60614 within 5 miles",
    preferredTimes: "Weekday mornings",
    paymentLabel: paymentLabel("self"),
  };
}

export function seedMessages(): ChatMessage[] {
  return [
    {
      id: "seed-user",
      role: "user",
      text: "Help me find a dental checkup next week.",
      time: "10:24 AM",
    },
    {
      id: "seed-assistant",
      role: "assistant",
      text: "I can help. What days work best for you?",
      time: "10:24 AM",
    },
  ];
}

export function defaultSnapshot(name = ""): CareSnapshot {
  return {
    version: 2,
    profile: defaultProfile(name),
    preferences: defaultPreferences(),
    messages: seedMessages(),
    draft: null,
    appointment: null,
    notices: [
      {
        id: "welcome",
        title: "Welcome to Chunggy",
        body: "Add your phone number so offices can reach you about a visit.",
        read: false,
      },
    ],
  };
}

export function digits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatPhone(value: string) {
  const next = digits(value).slice(0, 10);
  if (next.length < 4) return next;
  if (next.length < 7) return `(${next.slice(0, 3)}) ${next.slice(3)}`;
  return `(${next.slice(0, 3)}) ${next.slice(3, 6)}-${next.slice(6)}`;
}

export function formatDob(value: string) {
  const next = digits(value).slice(0, 8);
  const mm = next.slice(0, 2);
  const dd = next.slice(2, 4);
  const yyyy = next.slice(4, 8);
  if (next.length <= 2) return mm;
  if (next.length <= 4) return `${mm} / ${dd}`;
  return `${mm} / ${dd} / ${yyyy}`;
}

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const fullMonths = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function parseDob(value: string) {
  const parts = digits(value);
  if (parts.length !== 8) return null;
  const month = Number(parts.slice(0, 2));
  const day = Number(parts.slice(2, 4));
  const year = Number(parts.slice(4, 8));
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (year < 1900 || date > today) return null;
  return { month, day, year };
}

export function bornLabel(value: string) {
  const parsed = parseDob(value);
  if (!parsed) return "Date of birth not added";
  return `Born ${months[parsed.month - 1]} ${parsed.day}, ${parsed.year}`;
}

export function bornLong(value: string) {
  const parsed = parseDob(value);
  if (!parsed) return "Date of birth not added";
  return `${fullMonths[parsed.month - 1]} ${parsed.day}, ${parsed.year}`;
}

export function firstName(value: string) {
  const name = value.trim().split(/\s+/)[0];
  return name || "there";
}

export function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CW";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function locationLabel(zip: string) {
  return zip ? `Near ${zip} within 5 miles` : "Near your ZIP code";
}

export function clock(date = new Date()) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function aboutErrors(profile: Profile) {
  const errors: Partial<Record<"fullName" | "phone" | "dateOfBirth" | "zip", string>> =
    {};
  if (profile.fullName.trim().length < 2) {
    errors.fullName = "Enter your full name.";
  }
  if (digits(profile.phone).length !== 10) {
    errors.phone = "Enter a 10-digit phone number.";
  }
  if (!parseDob(profile.dateOfBirth)) {
    errors.dateOfBirth = "Enter a valid date of birth.";
  }
  if (!/^\d{5}$/.test(profile.zip)) {
    errors.zip = "Enter a 5-digit ZIP code.";
  }
  return errors;
}

export function insuranceErrors(profile: Profile) {
  const errors: Partial<Record<"insuranceCompany" | "memberId" | "planName", string>> =
    {};
  if (!profile.insuranceCompany.trim()) {
    errors.insuranceCompany = "Enter the insurance company.";
  }
  if (digits(profile.memberId).length < 4 && profile.memberId.trim().length < 4) {
    errors.memberId = "Enter the member ID from your card.";
  }
  if (!profile.planName.trim()) {
    errors.planName = "Enter the plan name.";
  }
  return errors;
}

const dental: Slot[] = [
  {
    id: "lakeview-1030",
    visitType: "Dental checkup",
    provider: "Lakeview Dental",
    dateLabel: "Tue, Oct 20, 2026",
    longDate: "Tuesday, October 20, 2026",
    timeLabel: "10:30 AM",
    endLabel: "11:00 AM",
    duration: "45 min",
    address: "123 Example Ave",
    cityLine: "Chicago, IL 60614",
    reference: "CW-2048",
    estimate: "$120 – $180",
    distance: "1.2 miles",
    rating: "4.8",
    period: "morning",
    startIso: "20261020T103000",
    endIso: "20261020T110000",
  },
  {
    id: "north-0900",
    visitType: "Dental checkup",
    provider: "North Branch Dental",
    dateLabel: "Wed, Oct 21, 2026",
    longDate: "Wednesday, October 21, 2026",
    timeLabel: "9:00 AM",
    endLabel: "9:45 AM",
    duration: "45 min",
    address: "880 North Ave",
    cityLine: "Chicago, IL 60614",
    reference: "CW-2091",
    estimate: "$110 – $170",
    distance: "2.4 miles",
    rating: "4.6",
    period: "morning",
    startIso: "20261021T090000",
    endIso: "20261021T094500",
  },
  {
    id: "riverside-1415",
    visitType: "Dental checkup",
    provider: "Riverside Smile Studio",
    dateLabel: "Thu, Oct 22, 2026",
    longDate: "Thursday, October 22, 2026",
    timeLabel: "2:15 PM",
    endLabel: "3:15 PM",
    duration: "60 min",
    address: "45 Canal St",
    cityLine: "Chicago, IL 60661",
    reference: "CW-2114",
    estimate: "$140 – $210",
    distance: "3.1 miles",
    rating: "4.7",
    period: "afternoon",
    startIso: "20261022T141500",
    endIso: "20261022T151500",
  },
];

const vision: Slot[] = [
  {
    id: "lakeview-vision",
    visitType: "Eye exam",
    provider: "Lakeview Vision",
    dateLabel: "Tue, Oct 20, 2026",
    longDate: "Tuesday, October 20, 2026",
    timeLabel: "11:15 AM",
    endLabel: "12:00 PM",
    duration: "45 min",
    address: "200 Lincoln Ave",
    cityLine: "Chicago, IL 60614",
    reference: "CW-2210",
    estimate: "$90 – $150",
    distance: "1.5 miles",
    rating: "4.7",
    period: "morning",
    startIso: "20261020T111500",
    endIso: "20261020T120000",
  },
  {
    id: "clark-optical",
    visitType: "Eye exam",
    provider: "Clark Street Optical",
    dateLabel: "Fri, Oct 23, 2026",
    longDate: "Friday, October 23, 2026",
    timeLabel: "3:30 PM",
    endLabel: "4:15 PM",
    duration: "45 min",
    address: "918 Clark St",
    cityLine: "Chicago, IL 60610",
    reference: "CW-2244",
    estimate: "$80 – $140",
    distance: "2.8 miles",
    rating: "4.5",
    period: "afternoon",
    startIso: "20261023T153000",
    endIso: "20261023T161500",
  },
];

const physical: Slot[] = [
  {
    id: "lincoln-clinic",
    visitType: "Annual physical",
    provider: "Lincoln Park Clinic",
    dateLabel: "Mon, Oct 19, 2026",
    longDate: "Monday, October 19, 2026",
    timeLabel: "8:40 AM",
    endLabel: "9:20 AM",
    duration: "40 min",
    address: "510 Armitage Ave",
    cityLine: "Chicago, IL 60614",
    reference: "CW-2302",
    estimate: "$180 – $260",
    distance: "1.8 miles",
    rating: "4.9",
    period: "morning",
    startIso: "20261019T084000",
    endIso: "20261019T092000",
  },
  {
    id: "wells-primary",
    visitType: "Annual physical",
    provider: "Wells Primary Care",
    dateLabel: "Wed, Oct 21, 2026",
    longDate: "Wednesday, October 21, 2026",
    timeLabel: "1:00 PM",
    endLabel: "1:40 PM",
    duration: "40 min",
    address: "77 Wells St",
    cityLine: "Chicago, IL 60601",
    reference: "CW-2338",
    estimate: "$170 – $250",
    distance: "3.4 miles",
    rating: "4.6",
    period: "afternoon",
    startIso: "20261021T130000",
    endIso: "20261021T134000",
  },
];

const derm: Slot[] = [
  {
    id: "southport-derm",
    visitType: "Dermatology visit",
    provider: "Southport Dermatology",
    dateLabel: "Thu, Oct 22, 2026",
    longDate: "Thursday, October 22, 2026",
    timeLabel: "10:00 AM",
    endLabel: "10:30 AM",
    duration: "30 min",
    address: "3400 Southport Ave",
    cityLine: "Chicago, IL 60657",
    reference: "CW-2408",
    estimate: "$200 – $320",
    distance: "2.1 miles",
    rating: "4.8",
    period: "morning",
    startIso: "20261022T100000",
    endIso: "20261022T103000",
  },
];

const catalog = [...dental, ...vision, ...physical, ...derm];

export function slotsFor(visitType: string, preferredTimes: string) {
  const matches = catalog.filter((slot) => slot.visitType === visitType);
  const list = matches.length > 0 ? matches : dental;
  const morningFirst = (a: Slot, b: Slot) =>
    a.period === b.period ? 0 : a.period === "morning" ? -1 : 1;
  if (preferredTimes === "Weekday mornings") {
    return [...list].sort(morningFirst);
  }
  if (preferredTimes === "Weekday afternoons") {
    return [...list].sort((a, b) => morningFirst(b, a));
  }
  return list;
}

export function assistantReply(text: string, preferences: Preferences) {
  const lower = text.toLowerCase();
  if (lower.includes("dental")) {
    return "I can look for a dental checkup. Weekday mornings are selected. Find options when you’re ready, or tell me a different time.";
  }
  if (lower.includes("eye")) {
    return "I can look for an eye exam. Update the visit type in booking preferences, then find options.";
  }
  if (lower.includes("physical") || lower.includes("primary")) {
    return "I can look for an annual physical. Set that visit type in booking preferences, then find options.";
  }
  if (lower.includes("morning")) {
    return `I’ll prefer weekday mornings, ${preferences.location.toLowerCase()}.`;
  }
  if (lower.includes("afternoon")) {
    return `I’ll prefer weekday afternoons, ${preferences.location.toLowerCase()}.`;
  }
  if (lower.includes("cost") || lower.includes("price")) {
    return "Estimates are typical self-pay ranges. The office confirms the final cost before you’re charged.";
  }
  if (lower.includes("insurance")) {
    return "You can use insurance, pay yourself, or decide when you book. Coverage still needs a check before anyone treats it as verified.";
  }
  return "Tell me the visit you want, a time of day, or a ZIP code. I can also take you to options with the preferences on the right.";
}

export function toIcs(appointment: Appointment, name: string) {
  const stamp = appointment.startIso;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Chunggy//Appointments//EN",
    "BEGIN:VEVENT",
    `UID:${appointment.reference}@chunggy.local`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${appointment.startIso}`,
    `DTEND:${appointment.endIso}`,
    `SUMMARY:${appointment.visitType} at ${appointment.provider}`,
    `LOCATION:${appointment.address}, ${appointment.cityLine}`,
    `DESCRIPTION:Appointment for ${name}. Reference ${appointment.reference}.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function mapsUrl(slot: Slot) {
  const query = encodeURIComponent(`${slot.address}, ${slot.cityLine}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
