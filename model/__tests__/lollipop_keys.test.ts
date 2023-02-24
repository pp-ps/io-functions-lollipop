import * as E from "fp-ts/lib/Either";
import * as tk from "timekeeper";

import {
  LolliPOPKeysModel,
  TTL_VALUE_AFTER_UPDATE,
  TTL_VALUE_FOR_RESERVATION
} from "../lollipop_keys";
import { PubKeyStatusEnum } from "../../generated/definitions/internal/PubKeyStatus";
import {
  aLolliPopPubKeys,
  aPendingLolliPopPubKeys,
  aRetrievedLolliPopPubKeys,
  containerMock,
  mockCreateItem,
  mockFetchAll
} from "../../__mocks__/lollipopkeysMock";

mockFetchAll.mockImplementation(async () => ({
  resources: []
}));

beforeEach(() => {
  jest.clearAllMocks();
});

const mockedNowTime = new Date(TTL_VALUE_FOR_RESERVATION * 1000);

beforeAll(() => {
  tk.freeze(mockedNowTime);
});

afterAll(() => {
  tk.reset();
});

describe("create", () => {
  it("GIVEN a working PopModel instance and a pendingLolliPopPubKeys, WHEN create is called, THEN upsert should be called with ttl equals to 15 minutes", async () => {
    const model = new LolliPOPKeysModel(containerMock);
    await model.create(aPendingLolliPopPubKeys)();
    expect(mockCreateItem).toHaveBeenCalledWith(
      expect.objectContaining({ ttl: TTL_VALUE_FOR_RESERVATION }),
      expect.anything()
    );
  });

  it("GIVEN a working PopModel instance should fail with a COSMOS_ERROR_RESPONSE if a document with same modelId exists", async () => {
    mockFetchAll.mockImplementationOnce(async () => ({
      resources: [aRetrievedLolliPopPubKeys]
    }));
    const model = new LolliPOPKeysModel(containerMock);
    const result = await model.create(aPendingLolliPopPubKeys)();

    expect(mockCreateItem).not.toHaveBeenCalled();
    expect(mockFetchAll).toHaveBeenCalled();
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("COSMOS_CONFLICT_RESPONSE");
    }
  });
});

describe("upsert", () => {
  it("Should return a COSMOS_DECODING_ERROR if the generated ttl was negative", async () => {
    mockFetchAll.mockImplementationOnce(async () => ({
      resources: [
        { ...aRetrievedLolliPopPubKeys, ttl: TTL_VALUE_FOR_RESERVATION - 2 }
      ]
    }));
    const model = new LolliPOPKeysModel(containerMock);
    const result = await model.upsert(aLolliPopPubKeys)();
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("COSMOS_DECODING_ERROR");
    }
    expect(mockCreateItem).not.toHaveBeenCalled();
  });

  it("GIVEN a working PopModel instance and a pendingLolliPopPubKeys, WHEN upsert is called, THEN super.upsert should be called with ttl equals to 2y", async () => {
    mockFetchAll.mockImplementationOnce(async () => ({
      resources: [
        { ...aRetrievedLolliPopPubKeys, status: PubKeyStatusEnum.PENDING }
      ]
    }));
    const model = new LolliPOPKeysModel(containerMock);
    await model.upsert(aLolliPopPubKeys)();
    expect(mockCreateItem).toHaveBeenCalledWith(
      expect.objectContaining({ ttl: TTL_VALUE_AFTER_UPDATE }),
      expect.anything()
    );
  });

  it("GIVEN a previous version with a ttl, the new version should have a ttl with the remaining time to reach the previous one", async () => {
    const aMockedTtl = TTL_VALUE_FOR_RESERVATION;
    mockFetchAll.mockImplementationOnce(async () => ({
      resources: [{ ...aRetrievedLolliPopPubKeys, ttl: aMockedTtl }]
    }));
    const model = new LolliPOPKeysModel(containerMock);
    await model.upsert(aLolliPopPubKeys)();
    expect(mockCreateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        ttl:
          // eslint
          aRetrievedLolliPopPubKeys._ts +
          aMockedTtl -
          mockedNowTime.getTime() / 1000
      }),
      expect.anything()
    );
  });
});
