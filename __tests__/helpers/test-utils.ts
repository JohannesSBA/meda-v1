export const TEST_USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
export const TEST_EVENT_ID = "event-uuid-1";

export function makeSessionUser(id = TEST_USER_ID) {
  return {
    user: { id, email: "user@test.com", name: "Test User" },
    response: null,
  };
}

export function futureDate(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
}

export function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: TEST_EVENT_ID,
    eventName: "Test Event",
    eventDatetime: futureDate(48),
    eventEndtime: futureDate(50),
    eventLocation: "Venue!longitude=38.7&latitude=9.0",
    capacity: 10,
    priceField: 100,
    ...overrides,
  };
}

export function makeRequest(url: string, body: object | string, ip = "1.2.3.4") {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
