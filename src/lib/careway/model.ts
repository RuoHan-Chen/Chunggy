export type PaymentChoice = "insurance" | "self" | "later";

export type CoverageStatus = "not_verified" | "requested";

export type Profile = {
  fullName: string;
  phone: string;
  dateOfBirth: string;
  addressLine1: string;
  city: string;
  region: string;
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
  provider?: ChatProvider;
  model?: string;
};

export type ChatProvider = "openai" | "oci";

export type ChatContextItem = {
  id: string;
  kind: "appointment" | "conversation";
  title: string;
  body: string;
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  bookingStep: BookingStep;
  preferences: Preferences;
  context: ChatContextItem[];
  provider: ChatProvider;
  pending: boolean;
  error: string | null;
};

export type BookingStep = "idle" | "visit" | "location" | "time" | "payment" | "ready";

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
  bookingStep: BookingStep;
  draft: Slot | null;
  appointment: Appointment | null;
  notices: Notice[];
};

export type CareDataMode = "database" | "fallback";

export type CareBootstrap = {
  mode: CareDataMode;
  snapshot: CareSnapshot;
  insurancePolicyId: string | null;
  providerSlots: Slot[];
  message: string | null;
};

export type CareSaveResult = {
  ok: boolean;
  persisted: boolean;
  message: string;
  insurancePolicyId?: string | null;
};

export const visitTypes = ["dental", "eye", "annual", "other"];

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
    addressLine1: "123 Example Ave",
    city: "Chicago",
    region: "IL",
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

export function emptyProfile(name = ""): Profile {
  return {
    fullName: name,
    phone: "",
    dateOfBirth: "",
    addressLine1: "",
    city: "",
    region: "",
    zip: "",
    language: "English",
    payment: "later",
    onboardingComplete: false,
    deferred: false,
    insuranceCompany: "",
    memberId: "",
    planName: "",
    cardFrontName: "",
    cardBackName: "",
    coverageStatus: "not_verified",
  };
}

export function defaultPreferences(): Preferences {
  return {
    visitType: "dental",
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
      text: "I can book a dental visit. Which ZIP should I search near?",
      time: "10:24 AM",
    },
  ];
}

export function chatTitleFromMessage(text: string) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return "New chat";
  const words = normalized.split(" ").slice(0, 7).join(" ");
  return `${words}${normalized.length > words.length ? "…" : ""}`;
}

export function chatFromSnapshot(snapshot: CareSnapshot, id = "chat-initial"): ChatSession {
  const firstUserMessage = snapshot.messages.find((message) => message.role === "user")?.text ?? "";
  return {
    id,
    title: chatTitleFromMessage(firstUserMessage),
    createdAt: "",
    updatedAt: "",
    messages: snapshot.messages,
    bookingStep: snapshot.bookingStep ?? inferBookingStep(snapshot.messages),
    preferences: snapshot.preferences,
    context: [],
    provider: "oci",
    pending: false,
    error: null,
  };
}

export function emptyChatSession(profile: Profile, id: string): ChatSession {
  const timestamp = new Date().toISOString();
  return {
    id,
    title: "New chat",
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [],
    bookingStep: "idle",
    preferences: {
      ...defaultPreferences(),
      location: locationLabel(profile.zip),
      paymentLabel: paymentLabel(profile.payment),
    },
    context: [],
    provider: "oci",
    pending: false,
    error: null,
  };
}

export function defaultSnapshot(name = ""): CareSnapshot {
  return {
    version: 2,
    profile: defaultProfile(name),
    preferences: defaultPreferences(),
    messages: seedMessages(),
    bookingStep: "location",
    draft: null,
    appointment: null,
    notices: [
      {
        id: "welcome",
        title: "Welcome to Assurance",
        body: "Add your phone number so offices can reach you about a visit.",
        read: false,
      },
    ],
  };
}

export function databaseSnapshot(name = ""): CareSnapshot {
  const profile = emptyProfile(name);
  return {
    ...defaultSnapshot(name),
    profile,
    preferences: {
      ...defaultPreferences(),
      location: locationLabel(profile.zip),
      paymentLabel: paymentLabel(profile.payment),
    },
    messages: [],
    bookingStep: "idle",
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
    visitType: "dental",
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
    visitType: "dental",
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
    visitType: "dental",
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
    visitType: "eye",
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
    visitType: "eye",
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
    visitType: "annual",
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
    visitType: "annual",
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
    visitType: "other",
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

export function canonicalVisitType(value: string) {
  const aliases: Record<string, string> = {
    "Dental checkup": "dental",
    "Eye exam": "eye",
    "Annual physical": "annual",
    "Dermatology visit": "other",
  };
  const next = aliases[value] ?? value;
  return visitTypes.includes(next) ? next : "dental";
}

export function slotsFor(visitType: string, preferredTimes: string) {
  const matches = catalog.filter((slot) => slot.visitType === canonicalVisitType(visitType));
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

const bookingSteps: BookingStep[] = ["idle", "visit", "location", "time", "payment", "ready"];

export function isBookingStep(value: string): value is BookingStep {
  return bookingSteps.includes(value as BookingStep);
}

export function inferBookingStep(messages: ChatMessage[]): BookingStep {
  const last = [...messages].reverse().find((message) => message.role === "assistant")?.text.toLowerCase() ?? "";
  if (last.includes("which zip") || last.includes("search near") || last.includes("5-digit zip")) return "location";
  if (last.includes("time of day") || last.includes("days work best")) return "time";
  if (last.includes("how do you want to pay") || last.includes("want to pay")) return "payment";
  if (last.includes("show options")) return "ready";
  if (last.includes("kind of visit")) return "visit";
  return "idle";
}

export function isLegacyBookingSeed(messages: ChatMessage[]) {
  return messages.length === 2 && messages[1]?.text === "I can help. What days work best for you?";
}

export function bookingChoices(step: BookingStep, zip: string) {
  if (step === "visit") return visitTypes;
  if (step === "location") return zip ? [`Use ${zip}`] : [];
  if (step === "time") return timeChoices;
  if (step === "payment") return ["Insurance", "Self-pay", "Decide later"];
  return [];
}

export type BookingTurn = {
  reply: string;
  step: BookingStep;
  preferences: Preferences;
  zip: string;
  payment: PaymentChoice;
};

export function bookingTurn(
  text: string,
  step: BookingStep,
  preferences: Preferences,
  profile: Profile,
): BookingTurn {
  const detectedVisit = detectVisit(text);
  const detectedTime = detectTime(text);
  const detectedZip = detectZip(text);
  const detectedPayment = detectPayment(text);
  const fresh = step === "idle" && (wantsBooking(text) || Boolean(detectedVisit));

  if (step === "idle" && !fresh) {
    return {
      reply: generalReply(text),
      step,
      preferences,
      zip: profile.zip,
      payment: profile.payment,
    };
  }

  const restart = Boolean(detectedVisit && detectedVisit !== preferences.visitType && !fresh);
  const passed = {
    visit: !fresh && !restart && step !== "idle" && step !== "visit",
    location: !fresh && !restart && (step === "time" || step === "payment" || step === "ready"),
    time: !fresh && !restart && (step === "payment" || step === "ready"),
    payment: !fresh && !restart && step === "ready",
  };
  const visitType = detectedVisit ?? (passed.visit ? preferences.visitType : "");
  const zip = detectedZip ?? (passed.location ? profile.zip : "");
  const preferredTimes = detectedTime ?? (passed.time ? preferences.preferredTimes : "");
  const nextPreferences: Preferences = {
    ...preferences,
    visitType: visitType || preferences.visitType,
    location: zip ? locationLabel(zip) : preferences.location,
    preferredTimes: preferredTimes || preferences.preferredTimes,
    paymentLabel: paymentLabel(detectedPayment ?? profile.payment),
  };
  const known = {
    visit: Boolean(visitType),
    location: Boolean(zip),
    time: Boolean(preferredTimes),
    payment: Boolean(detectedPayment) || passed.payment,
  };
  const next = nextBookingStep(known);
  const advanced = next !== step || fresh;
  const payment = detectedPayment ?? profile.payment;
  return {
    reply: advanced ? bookingReply(next, nextPreferences, zip, payment) : bookingNudge(step),
    step: next,
    preferences: {
      ...nextPreferences,
      paymentLabel: detectedPayment || passed.payment ? paymentLabel(payment) : preferences.paymentLabel,
    },
    zip: zip || profile.zip,
    payment,
  };
}

function nextBookingStep(known: { visit: boolean; location: boolean; time: boolean; payment: boolean }): BookingStep {
  if (!known.visit) return "visit";
  if (!known.location) return "location";
  if (!known.time) return "time";
  if (!known.payment) return "payment";
  return "ready";
}

function bookingReply(step: BookingStep, preferences: Preferences, zip: string, payment: PaymentChoice) {
  const visit = preferences.visitType;
  const article = /^[aeiou]/i.test(visit) ? "an" : "a";
  if (step === "visit") return "What kind of visit do you want?";
  if (step === "location") return `I can book ${article} ${visit} visit. Which ZIP should I search near?`;
  if (step === "time") return `I’ll look near ${zip || "your ZIP"}. What time of day works best?`;
  if (step === "payment") return `${preferences.preferredTimes}. How do you want to pay?`;
  return `I can look for ${visit} visits ${preferences.location.toLowerCase()}, ${preferences.preferredTimes.toLowerCase()}, ${paymentTitle(payment).toLowerCase()}. I can show options when you’re ready.`;
}

function bookingNudge(step: BookingStep) {
  if (step === "visit") return "Choose dental, eye, annual, or other.";
  if (step === "location") return "Send a 5-digit ZIP, or use the one on your profile.";
  if (step === "time") return "Choose weekday mornings, weekday afternoons, or flexible.";
  if (step === "payment") return "Choose insurance, self-pay, or decide later.";
  return "I can show options when you’re ready.";
}

function wantsBooking(text: string) {
  return /\b(book|booking|appointment|schedule|checkup|check-up)\b/i.test(text);
}

function detectVisit(text: string) {
  const lower = text.toLowerCase();
  if (visitTypes.includes(lower.trim())) return lower.trim();
  if (/\b(eye|vision|optical)\b/.test(lower)) return "eye";
  if (/\b(dental|dentist|tooth|teeth)\b/.test(lower)) return "dental";
  if (/\b(annual|physical|primary)\b/.test(lower)) return "annual";
  if (/\b(dermat|skin)\b/.test(lower)) return "other";
  return null;
}

function detectTime(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("afternoon")) return "Weekday afternoons";
  if (lower.includes("morning")) return "Weekday mornings";
  if (lower.includes("flexible")) return "Flexible";
  return null;
}

function detectZip(text: string) {
  return text.match(/\b(\d{5})\b/)?.[1] ?? null;
}

function detectPayment(text: string): PaymentChoice | null {
  const lower = text.toLowerCase();
  if (lower.includes("insurance")) return "insurance";
  if (lower.includes("self-pay") || lower.includes("self pay") || lower.includes("pay myself")) return "self";
  if (lower.includes("decide later") || lower.includes("decide at")) return "later";
  return null;
}

function generalReply(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("cost") || lower.includes("price")) {
    return "Estimates are typical self-pay ranges. The office confirms the final cost before you’re charged.";
  }
  if (lower.includes("insurance")) {
    return "You can use insurance, pay yourself, or decide when you book. Coverage still needs a check before anyone treats it as verified.";
  }
  return "Tell me the visit you want, such as dental, eye, annual, or other. I’ll ask where, when, and how you want to pay.";
}

export function toIcs(appointment: Appointment, name: string) {
  const stamp = appointment.startIso;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Assurance//Appointments//EN",
    "BEGIN:VEVENT",
    `UID:${appointment.reference}@assurance.local`,
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
