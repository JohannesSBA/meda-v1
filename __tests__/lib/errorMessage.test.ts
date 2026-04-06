import { describe, expect, it } from "vitest";
import { BrowserApiError } from "@/lib/browserApi";
import { getErrorMessage } from "@/lib/errorMessage";

describe("getErrorMessage", () => {
  it("prefers flattened field validation errors over the generic payload message", () => {
    const error = new BrowserApiError("Invalid monthly booking payload", 400, {
      error: "Invalid monthly booking payload",
      issues: {
        formErrors: [],
        fieldErrors: {
          memberEmails: ["Invalid email address"],
        },
      },
    });

    expect(getErrorMessage(error)).toBe("Invalid email address");
  });

  it("returns form-level validation errors when present", () => {
    const error = new BrowserApiError("Invalid request", 400, {
      error: "Invalid request",
      issues: {
        formErrors: ["Choose at least one player"],
        fieldErrors: {},
      },
    });

    expect(getErrorMessage(error)).toBe("Choose at least one player");
  });

  it("falls back to the thrown error message when no validation details exist", () => {
    expect(getErrorMessage(new Error("Failed to create booking"))).toBe(
      "Failed to create booking",
    );
  });
});
