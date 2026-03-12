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
      setConfirmingPayment(false);
      confirmedTxRefRef.current = null;
      return;
    }
    if (confirmedTxRefRef.current === txRef) return;
    confirmedTxRefRef.current = txRef;

    let cancelled = false;
    const confirmPayment = async () => {
      setConfirmingPayment(true);
      try {
        const response = await browserApi.post<{ quantity?: number }>(
          "/api/payments/chapa/confirm",
          { txRef },
        );
        const addedTickets = Number(response.quantity) || 0;
        if (!cancelled && addedTickets > 0) {
          const nextTicketCount = myTickets + addedTickets;
          setMyTickets(nextTicketCount);
          if (nextTicketCount > 1) {
            const targetEventId =
              decodedSelectedFromQuery &&
              occurrenceOptions.some(
                (entry) => entry.eventId === decodedSelectedFromQuery,
              )
                ? decodedSelectedFromQuery
                : selectedEventId;
            await generateShareLink(targetEventId);
          }
        }
        if (!cancelled) {
          toast.success("Payment confirmed. Ticket added.", {
            id: `payment-${txRef}`,
          });
          const returnEventId =
            decodedSelectedFromQuery &&
            occurrenceOptions.some((entry) => entry.eventId === decodedSelectedFromQuery)
              ? decodedSelectedFromQuery
              : selectedEventId;
          const encodedOccurrence = encodeURIComponent(returnEventId);
          router.replace(`/events/${returnEventId}?occurrence=${encodedOccurrence}`);
          router.refresh();
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(getErrorMessage(error) || "Unable to confirm payment", {
            id: `payment-error-${txRef}`,
          });
        }
      } finally {
        setConfirmingPayment(false);
      }
    };

    void confirmPayment();
    return () => {
      cancelled = true;
    };
  }, [
    decodedSelectedFromQuery,
    generateShareLink,
    myTickets,
    occurrenceOptions,
    paymentProvider,
    router,
    selectedEventId,
    setMyTickets,
    txRef,
    userId,
  ]);

  return { confirmingPayment };
}
