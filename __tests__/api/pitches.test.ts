import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mockRequirePitchOwnerUser = vi.fn();
const mockCreatePitch = vi.fn();
const mockGetPitchByIdForOwner = vi.fn();
const mockListOwnerPitches = vi.fn();
const mockUpdatePitch = vi.fn();

vi.mock("@/lib/auth/guards", () => ({
  requirePitchOwnerUser: mockRequirePitchOwnerUser,
}));

vi.mock("@/services/pitches", () => ({
  createPitch: mockCreatePitch,
  getPitchByIdForOwner: mockGetPitchByIdForOwner,
  listOwnerPitches: mockListOwnerPitches,
  updatePitch: mockUpdatePitch,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const TEST_USER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TEST_PITCH_ID = "11111111-2222-3333-4444-555555555555";
const CATEGORY_ID = "66666666-7777-8888-9999-aaaaaaaaaaaa";

function makeSessionUser() {
  return {
    user: { id: TEST_USER_ID, email: "owner@test.com", role: "pitch_owner" },
    response: null,
  };
}

function makePitchFormData() {
  const formData = new FormData();
  formData.set("name", "Meda Arena");
  formData.set("description", "Indoor five-a-side");
  formData.set("addressLabel", "Bole");
  formData.set("latitude", "9.015240");
  formData.set("longitude", "38.814349");
  formData.set("categoryId", CATEGORY_ID);
  return formData;
}

function makeImageFile() {
  return new File(["pitch-image"], "pitch.png", { type: "image/png" });
}

async function importCreateHandler() {
  const mod = await import("@/app/api/pitches/route");
  return mod.POST;
}

async function importPatchHandler() {
  const mod = await import("@/app/api/pitches/[id]/route");
  return mod.PATCH;
}

describe("pitch routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePitchOwnerUser.mockResolvedValue(makeSessionUser());
    mockCreatePitch.mockResolvedValue({ id: TEST_PITCH_ID });
    mockUpdatePitch.mockResolvedValue({ id: TEST_PITCH_ID });
    mockGetPitchByIdForOwner.mockResolvedValue({ id: TEST_PITCH_ID });
    mockListOwnerPitches.mockResolvedValue([]);
  });

  it("returns 401 when pitch owner auth fails on create", async () => {
    mockRequirePitchOwnerUser.mockResolvedValue({
      user: null,
      response: NextResponse.json({ error: "Unauthenticated" }, { status: 401 }),
    });

    const POST = await importCreateHandler();
    const response = await POST(
      new Request("http://localhost/api/pitches", {
        method: "POST",
        body: makePitchFormData(),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("parses multipart place creation payloads and forwards image buffers", async () => {
    const formData = makePitchFormData();
    formData.set("image", makeImageFile());

    const POST = await importCreateHandler();
    const response = await POST(
      new Request("http://localhost/api/pitches", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(201);
    expect(mockCreatePitch).toHaveBeenCalledTimes(1);

    const payload = mockCreatePitch.mock.calls[0][0];
    expect(payload.ownerId).toBe(TEST_USER_ID);
    expect(payload.name).toBe("Meda Arena");
    expect(payload.image.mimeType).toBe("image/png");
    expect(payload.image.ext).toBe("png");
    expect(payload.image.buffer).toBeInstanceOf(Buffer);
    expect(payload.image.buffer.toString()).toBe("pitch-image");
  });

  it("returns 400 when required pitch fields are missing", async () => {
    const formData = new FormData();
    formData.set("addressLabel", "Bole");

    const POST = await importCreateHandler();
    const response = await POST(
      new Request("http://localhost/api/pitches", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
    expect(mockCreatePitch).not.toHaveBeenCalled();
  });

  it("parses multipart place updates and forwards the selected image", async () => {
    const formData = new FormData();
    formData.set("name", "Updated Arena");
    formData.set("image", makeImageFile());

    const PATCH = await importPatchHandler();
    const response = await PATCH(
      new Request(`http://localhost/api/pitches/${TEST_PITCH_ID}`, {
        method: "PATCH",
        body: formData,
      }),
      {
        params: Promise.resolve({ id: TEST_PITCH_ID }),
      },
    );

    expect(response.status).toBe(200);
    expect(mockUpdatePitch).toHaveBeenCalledTimes(1);

    const payload = mockUpdatePitch.mock.calls[0][0];
    expect(payload.ownerId).toBe(TEST_USER_ID);
    expect(payload.pitchId).toBe(TEST_PITCH_ID);
    expect(payload.name).toBe("Updated Arena");
    expect(payload.image.mimeType).toBe("image/png");
    expect(payload.image.buffer.toString()).toBe("pitch-image");
  });
});
