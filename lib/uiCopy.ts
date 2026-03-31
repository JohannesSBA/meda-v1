export const uiCopy = {
  nav: {
    play: "Play",
    tickets: "Tickets",
    host: "Host",
    profile: "Profile",
    admin: "Admin",
    createMatch: "Create match",
  },
  play: {
    playNow: "Play now",
    findMatch: "Find a match",
    allTimes: "All times",
    singleVisit: "Single visit",
  },
  host: {
    hostPlan: "Host plan",
    bookingTimes: "Booking times",
    groupPayment: "Group payment",
    people: "People",
    money: "Money",
    places: "Places",
  },
  tickets: {
    group: "Group",
    needsPlayerName: "Needs player name",
    bookingType: "Booking type",
    monthlyGroupBooking: "Monthly group booking",
    comingUp: "Coming up",
    keepUnderMyAccount: "Keep under my account",
    sendToAnotherPerson: "Send to another person",
  },
  statusHelpers: {
    waitingForPayment: "Finish payment before this booking becomes active.",
    needsPlayerName: "Add the player name before this ticket can be used.",
    booked: "You are all set for this booking.",
    expired: "This item is no longer active.",
    cancelled: "This item will not be used.",
    finished: "This booking already happened.",
    waitingForGroupPayment: "Everyone in the group still needs to finish payment before the deadline.",
    paidInFull: "The full amount is paid and the booking is locked in.",
    noGroupPayment: "No group payment is needed for this item.",
    bought: "This ticket is saved under your purchase.",
    assigned: "This ticket has a player attached to it.",
    readyToUse: "This ticket can be checked in at the venue.",
    checkedIn: "This ticket has already been scanned.",
  },
} as const;

const ticketStatusLabels: Record<string, string> = {
  PURCHASED: "Bought",
  ASSIGNMENT_PENDING: uiCopy.tickets.needsPlayerName,
  ASSIGNED: "Assigned",
  VALID: "Ready to use",
  CHECKED_IN: "Checked in",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

const bookingStatusLabels: Record<string, string> = {
  PENDING: "Waiting for payment",
  CONFIRMED: "Booked",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  COMPLETED: "Finished",
};

const poolStatusLabels: Record<string, string> = {
  PENDING: "Waiting for group payment",
  FULFILLED: "Paid in full",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

const productTypeLabels: Record<string, string> = {
  DAILY: "Single visit",
  MONTHLY: uiCopy.tickets.monthlyGroupBooking,
};

export function formatTicketStatusLabel(status: string) {
  return ticketStatusLabels[status] ?? status.replace(/_/g, " ").toLowerCase();
}

export function formatBookingStatusLabel(status: string) {
  return bookingStatusLabels[status] ?? status.replace(/_/g, " ").toLowerCase();
}

export function formatPoolStatusLabel(status: string | null | undefined) {
  if (!status) return "No group payment";
  return poolStatusLabels[status] ?? status.replace(/_/g, " ").toLowerCase();
}

export function formatProductTypeLabel(type: string) {
  return productTypeLabels[type] ?? type.replace(/_/g, " ").toLowerCase();
}

export function getBookingStatusHelper(status: string) {
  switch (status) {
    case "PENDING":
      return uiCopy.statusHelpers.waitingForPayment;
    case "CONFIRMED":
      return uiCopy.statusHelpers.booked;
    case "EXPIRED":
      return uiCopy.statusHelpers.expired;
    case "CANCELLED":
      return uiCopy.statusHelpers.cancelled;
    case "COMPLETED":
      return uiCopy.statusHelpers.finished;
    default:
      return "";
  }
}

export function getPoolStatusHelper(status: string | null | undefined) {
  if (!status) return uiCopy.statusHelpers.noGroupPayment;
  switch (status) {
    case "PENDING":
      return uiCopy.statusHelpers.waitingForGroupPayment;
    case "FULFILLED":
      return uiCopy.statusHelpers.paidInFull;
    case "EXPIRED":
      return uiCopy.statusHelpers.expired;
    case "CANCELLED":
      return uiCopy.statusHelpers.cancelled;
    default:
      return "";
  }
}

export function getTicketStatusHelper(status: string) {
  switch (status) {
    case "PURCHASED":
      return uiCopy.statusHelpers.bought;
    case "ASSIGNMENT_PENDING":
      return uiCopy.statusHelpers.needsPlayerName;
    case "ASSIGNED":
      return uiCopy.statusHelpers.assigned;
    case "VALID":
      return uiCopy.statusHelpers.readyToUse;
    case "CHECKED_IN":
      return uiCopy.statusHelpers.checkedIn;
    case "EXPIRED":
      return uiCopy.statusHelpers.expired;
    case "CANCELLED":
      return uiCopy.statusHelpers.cancelled;
    default:
      return "";
  }
}
