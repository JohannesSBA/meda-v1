/**
 * Email service barrel re-export.
 *
 * Maintains @/services/email import path for backward compatibility.
 * All email sending is handled by Resend via services/emails/.
 */

export { sendTicketConfirmationEmail } from "./emails/ticketConfirmation";
export { sendEventReminderEmail } from "./emails/reminder";
export { sendRefundConfirmationEmail } from "./emails/refundConfirmation";
export { sendWaitlistSpotAvailableEmail } from "./emails/waitlistNotification";
