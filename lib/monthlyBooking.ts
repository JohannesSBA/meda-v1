export type MonthlyBookingPayload = {
  slotId: string;
  partyId?: string;
  partyName?: string;
  memberEmails: string[];
};

type BuildMonthlyBookingPayloadArgs = {
  slotId: string;
  selectedGroupId?: string | null;
  groupName?: string | null;
  memberEmails?: string | null;
};

export function normalizeMonthlyMemberEmails(value?: string | null) {
  return [
    ...new Set(
      (value ?? "")
        .split(/[,\n]/)
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function buildMonthlyBookingPayload(
  args: BuildMonthlyBookingPayloadArgs,
): MonthlyBookingPayload {
  const selectedGroupId = args.selectedGroupId?.trim();
  if (selectedGroupId) {
    return {
      slotId: args.slotId,
      partyId: selectedGroupId,
      memberEmails: [],
    };
  }

  const payload: MonthlyBookingPayload = {
    slotId: args.slotId,
    memberEmails: normalizeMonthlyMemberEmails(args.memberEmails),
  };
  const normalizedGroupName = args.groupName?.trim();

  if (normalizedGroupName) {
    payload.partyName = normalizedGroupName;
  }

  return payload;
}
