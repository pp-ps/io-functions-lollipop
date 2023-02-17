import * as E from "fp-ts/lib/Either";
import * as tk from "timekeeper";

import { Container } from "@azure/cosmos";
import { AssertionRef } from "@pagopa/io-functions-commons/dist/generated/definitions/lollipop/AssertionRef";
import { AssertionTypeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/lollipop/AssertionType";
import { CosmosResource } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  AssertionFileName,
  LolliPOPKeysModel,
  PendingLolliPopPubKeys,
  LolliPopPubKeys,
  RetrievedLolliPopPubKeys,
  TTL_VALUE_AFTER_UPDATE,
  TTL_VALUE_FOR_RESERVATION
} from "../lollipop_keys";
import { PubKeyStatusEnum } from "../../generated/definitions/internal/PubKeyStatus";

const aFiscalCode = "RLDBSV36A78Y792X" as FiscalCode;
const anAssertionRef = "sha256-p1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c" as AssertionRef;
const anAssertionFileName = `${aFiscalCode}-${anAssertionRef}` as AssertionFileName;
const aPubKey = "aValidPubKey" as NonEmptyString;

const aCosmosResourceMetadata: Omit<CosmosResource, "id"> = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
};

const aPendingLolliPopPubKeys: PendingLolliPopPubKeys = {
  assertionRef: anAssertionRef,
  pubKey: aPubKey,
  status: PubKeyStatusEnum.PENDING
};

const aLolliPopPubKeys: LolliPopPubKeys = {
  assertionFileName: anAssertionFileName,
  assertionRef: anAssertionRef,
  assertionType: AssertionTypeEnum.OIDC,
  expiredAt: new Date(),
  fiscalCode: aFiscalCode,
  pubKey: aPubKey,
  status: PubKeyStatusEnum.VALID
};

const aRetrievedLolliPopPubKeys: RetrievedLolliPopPubKeys = {
  id: `${aLolliPopPubKeys.assertionRef}-${"0".repeat(16)}` as NonEmptyString,
  ...aCosmosResourceMetadata,
  ...aLolliPopPubKeys,
  ttl: TTL_VALUE_AFTER_UPDATE, // 2y
  version: 0 as NonNegativeInteger
};

const mockCreateItem = jest.fn();
const mockUpsert = jest.fn();
const mockFetchAll = jest.fn();

mockFetchAll.mockImplementation(async () => ({
  resources: []
}));

const containerMock = ({
  items: {
    create: mockCreateItem,
    query: jest.fn(() => ({
      fetchAll: mockFetchAll
    })),
    upsert: mockUpsert
  }
} as unknown) as Container;

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
  it("GIVEN a working PopModel instance and a pendingLolliPopPubKeys, WHEN create is called, THEN upsert should be called with ttl equals to 2y", async () => {
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

    expect(mockCreateItem).toHaveBeenCalled();
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("COSMOS_ERROR_RESPONSE");
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
