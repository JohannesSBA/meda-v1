export type CustomerProfileDetailHeaderCopy = {
  title: string;
  description: string;
};

/**
 * Copy for the Customers tab right-hand pane (list + detail).
 * Distinguishes filtered-empty vs idle vs selected row.
 */
export function getCustomerProfileDetailHeaderCopy(params: {
  listEmpty: boolean;
  selectedCustomer: { customerName: string; customerEmail?: string | null } | null;
}): CustomerProfileDetailHeaderCopy {
  if (params.listEmpty) {
    return {
      title: "Nothing to inspect yet",
      description:
        "No customers match the current date range and filters. Adjust the filters or check back after new bookings.",
    };
  }
  if (!params.selectedCustomer) {
    return {
      title: "Choose a customer",
      description:
        "Select a row in the list to see payment history, attendance, and monthly pass usage.",
    };
  }
  return {
    title: params.selectedCustomer.customerName,
    description: params.selectedCustomer.customerEmail ?? "No email on file",
  };
}
