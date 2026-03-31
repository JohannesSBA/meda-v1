import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { browserApi } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";
import type { EventOccurrence } from "@/app/types/eventTypes";

const PAYMENT_POLL_INTERVAL_MS = 3000;
const PAYMENT_POLL_LIMIT = 40;

type SearchParamsLike = Pick<URLSearchParams, "get">;
type RegisterRouter = {
  replace: (href: string) => void;
  refresh: () => void;
};

type UseRegisterPaymentConfirmationArgs = {
  router: RegisterRouter;
  searchParams: SearchParamsLike;
  userId: string | null;
  selectedEventId: string;
  decodedSelectedFromQuery: string | null;
  occurrenceOptions: EventOccurrence[];
  myTickets: number;
  setMyTickets: Dispatch<SetStateAction<number>>;
  refreshTicketState: (
    eventId?: string,
  ) => Promise<{ heldTicketCount: number } | null>;
  generateShareLink: (eventId: string) => Promise<void>;
};

export function useRegisterPaymentConfirmation({
  router,
  searchParams,
  userId,
  selectedEventId,
  decodedSelectedFromQuery,
  occurrenceOptions,
  myTickets,
  setMyTickets,
  refreshTicketState,
  generateShareLink,
}: UseRegisterPaymentConfirmationArgs) {
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  const paymentProvider = useMemo(
    () => searchParams.get("payment") ?? searchParams.get("amp;payment"),
    [searchParams],
  );
  const txRef = useMemo(
    () =>
      searchParams.get("tx_ref") ??
      searchParams.get("txRef") ??
      searchParams.get("amp;tx_ref") ??
      searchParams.get("amp%3Btx_ref"),
    [searchParams],
  );
  const confirmedTxRefRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || paymentProvider !== "chapa" || !txRef) {
      confirmedTxRefRef.current = null;
      return;
    }
    if (confirmedTxRefRef.current === txRef) return;
    confirmedTxRefRef.current = txRef;

    let cancelled = false;
    let pollTimer: number | null = null;
    const confirmPayment = async (attempt = 0) => {
      setConfirmingPayment(true);
      try {
        const response = await browserApi.postDetailed<{
          quantity?: number;
          status?: string;
          message?: string;
        }>(
          "/api/payments/chapa/confirm",
          { txRef },
        );

        if (
          response.status === 202 ||
          response.data.status === "processing"
        ) {
          if (attempt >= PAYMENT_POLL_LIMIT) {
            if (!cancelled) {
              toast.error(
                response.data.message ||
                  "Payment is still processing. Please try confirming again shortly.",
                { id: `payment-error-${txRef}` },
              );
              setConfirmingPayment(false);
            }
            return;
          }
          pollTimer = window.setTimeout(() => {
            void confirmPayment(attempt + 1);
          }, PAYMENT_POLL_INTERVAL_MS);
          return;
        }

        const targetEventId =
          decodedSelectedFromQuery &&
          occurrenceOptions.some((entry) => entry.eventId === decodedSelectedFromQuery)
            ? decodedSelectedFromQuery
            : selectedEventId;
        const nextState = await refreshTicketState(targetEventId);
        const nextTicketCount = nextState?.heldTicketCount ?? myTickets;

        if (!cancelled) {
          setMyTickets(nextTicketCount);
          if (nextTicketCount > 1) {
            await generateShareLink(targetEventId);
          }
        }
        if (!cancelled) {
          toast.success("Payment confirmed. Ticket added.", {
            id: `payment-${txRef}`,
          });
          const encodedOccurrence = encodeURIComponent(targetEventId);
          router.replace(`/events/${targetEventId}?occurrence=${encodedOccurrence}`);
          router.refresh();
          setConfirmingPayment(false);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error) || "Unable to confirm payment", {
            id: `payment-error-${txRef}`,
          });
          setConfirmingPayment(false);
        }
      }
    };

    void confirmPayment();
    return () => {
      cancelled = true;
      if (pollTimer != null) {
        window.clearTimeout(pollTimer);
      }
    };
  }, [
    decodedSelectedFromQuery,
    generateShareLink,
    myTickets,
    occurrenceOptions,
    paymentProvider,
    refreshTicketState,
    router,
    selectedEventId,
    setMyTickets,
    txRef,
    userId,
  ]);

  return { confirmingPayment };
}
