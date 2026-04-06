import { beforeEach, describe, expect, it, vi } from "vitest";

const mockResolveCategoryIdWithFallback = vi.fn();
const mockPitchCreate = vi.fn();
const mockPitchDelete = vi.fn();
const mockPitchFindFirst = vi.fn();
const mockPitchUpdate = vi.fn();
const mockNotifyUserById = vi.fn();
const mockUploadPitchImageUnified = vi.fn();

vi.mock("@/lib/categoryDefaults", () => ({
  resolveCategoryIdWithFallback: mockResolveCategoryIdWithFallback,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pitch: {
      create: mockPitchCreate,
      delete: mockPitchDelete,
      findFirst: mockPitchFindFirst,
      findMany: vi.fn(),
      update: mockPitchUpdate,
    },
  },
}));

vi.mock("@/services/actionNotifications", () => ({
  notifyUserById: mockNotifyUserById,
}));

vi.mock("@/lib/uploadPitchImage", () => ({
  uploadPitchImageUnified: mockUploadPitchImageUnified,
}));

const TEST_OWNER_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TEST_PITCH_ID = "11111111-2222-3333-4444-555555555555";
const CATEGORY_ID = "66666666-7777-8888-9999-aaaaaaaaaaaa";
const UPLOADED_IMAGE_URL = "https://example.com/pitch/cover.png";

function makePitchRecord(
  overrides: Partial<{
    id: string;
    name: string;
    pictureUrl: string | null;
    categoryId: string;
  }> = {},
) {
  return {
    id: TEST_PITCH_ID,
    ownerId: TEST_OWNER_ID,
    name: "Meda Arena",
    description: "Indoor place",
    pictureUrl: null,
    addressLabel: "Bole",
    latitude: 9.01524,
    longitude: 38.814349,
    categoryId: CATEGORY_ID,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    category: {
      categoryName: "Soccer",
    },
    schedules: [],
    subscriptions: [],
    _count: {
      slots: 0,
    },
    ...overrides,
  };
}

function makePitchImage() {
  return {
    buffer: Buffer.from("pitch-image"),
    mimeType: "image/png",
    ext: "png",
  };
}

async function importPitchService() {
  return import("@/services/pitches");
}

describe("services/pitches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveCategoryIdWithFallback.mockResolvedValue(CATEGORY_ID);
    mockNotifyUserById.mockResolvedValue(undefined);
    mockUploadPitchImageUnified.mockResolvedValue(UPLOADED_IMAGE_URL);
    mockPitchCreate.mockResolvedValue(makePitchRecord());
    mockPitchUpdate.mockResolvedValue(makePitchRecord({ pictureUrl: UPLOADED_IMAGE_URL }));
    mockPitchDelete.mockResolvedValue(undefined);
  });

  it("uploads a place image and persists the bucket URL on create", async () => {
    const { createPitch } = await importPitchService();
    const image = makePitchImage();

    const result = await createPitch({
      ownerId: TEST_OWNER_ID,
      name: "Meda Arena",
      image,
    });

    expect(mockUploadPitchImageUnified).toHaveBeenCalledWith(TEST_PITCH_ID, image);
    expect(mockPitchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_PITCH_ID },
        data: { pictureUrl: UPLOADED_IMAGE_URL },
      }),
    );
    expect(result.pictureUrl).toBe(UPLOADED_IMAGE_URL);
  });

  it("deletes the created place if image upload fails during create", async () => {
    const { createPitch } = await importPitchService();
    mockUploadPitchImageUnified.mockRejectedValueOnce(new Error("Storage unavailable"));

    await expect(
      createPitch({
        ownerId: TEST_OWNER_ID,
        name: "Meda Arena",
        image: makePitchImage(),
      }),
    ).rejects.toThrow("Storage unavailable");

    expect(mockPitchDelete).toHaveBeenCalledWith({
      where: { id: TEST_PITCH_ID },
    });
  });

  it("keeps the existing picture when no new image is provided on update", async () => {
    const { updatePitch } = await importPitchService();
    mockPitchFindFirst.mockResolvedValue({
      id: TEST_PITCH_ID,
      categoryId: CATEGORY_ID,
      pictureUrl: "https://example.com/existing.png",
    });
    mockPitchUpdate.mockResolvedValue(
      makePitchRecord({ pictureUrl: "https://example.com/existing.png" }),
    );

    const result = await updatePitch({
      ownerId: TEST_OWNER_ID,
      pitchId: TEST_PITCH_ID,
      name: "Updated Arena",
    });

    expect(mockUploadPitchImageUnified).not.toHaveBeenCalled();
    expect(mockPitchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pictureUrl: "https://example.com/existing.png",
        }),
      }),
    );
    expect(result.pictureUrl).toBe("https://example.com/existing.png");
  });

  it("replaces the picture when a new place image is uploaded on update", async () => {
    const { updatePitch } = await importPitchService();
    const image = makePitchImage();
    mockPitchFindFirst.mockResolvedValue({
      id: TEST_PITCH_ID,
      categoryId: CATEGORY_ID,
      pictureUrl: "https://example.com/existing.png",
    });
    mockPitchUpdate.mockResolvedValue(makePitchRecord({ pictureUrl: UPLOADED_IMAGE_URL }));

    const result = await updatePitch({
      ownerId: TEST_OWNER_ID,
      pitchId: TEST_PITCH_ID,
      image,
    });

    expect(mockUploadPitchImageUnified).toHaveBeenCalledWith(TEST_PITCH_ID, image);
    expect(mockPitchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pictureUrl: UPLOADED_IMAGE_URL,
        }),
      }),
    );
    expect(result.pictureUrl).toBe(UPLOADED_IMAGE_URL);
  });
});
