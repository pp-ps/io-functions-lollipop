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
  PendingPopDocument,
  LolliPopPubKeys,
  PopDocumentStatusEnum,
  RetrievedLolliPopPubKeys,
  TTL_VALUE_AFTER_UPDATE,
  TTL_VALUE_FOR_RESERVATION
} from "../lollipop_keys";

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

const aPendingPopDocument: PendingPopDocument = {
  assertionRef: anAssertionRef,
  pubKey: aPubKey,
  status: PopDocumentStatusEnum.PENDING
};

const aPopDocument: LolliPopPubKeys = {
  assertionFileName: anAssertionFileName,
  assertionRef: anAssertionRef,
  assertionType: AssertionTypeEnum.OIDC,
  expiredAt: new Date(),
  fiscalCode: aFiscalCode,
  pubKey: aPubKey,
  status: PopDocumentStatusEnum.VALID
};

const aRetrievedPopDocument: RetrievedLolliPopPubKeys = {
  id: `${aPopDocument.assertionRef}-${"0".repeat(16)}` as NonEmptyString,
  ...aCosmosResourceMetadata,
  ...aPopDocument,
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
  it("GIVEN a working PopModel instance and a pending popDocument, WHEN create is called, THEN upsert should be called with ttl equals to 2y", async () => {
    const model = new LolliPOPKeysModel(containerMock);
    await model.create(aPendingPopDocument)();
    expect(mockCreateItem).toHaveBeenCalledWith(
      expect.objectContaining({ ttl: TTL_VALUE_FOR_RESERVATION }),
      expect.anything()
    );
  });

  it("GIVEN a working PopModel instance should fail with a COSMOS_ERROR_RESPONSE if a documnet with same modelId exists", async () => {
    mockFetchAll.mockImplementationOnce(async () => ({
      resources: [aRetrievedPopDocument]
    }));
    const model = new LolliPOPKeysModel(containerMock);
    const result = await model.create(aPendingPopDocument)();

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
        { ...aRetrievedPopDocument, ttl: TTL_VALUE_FOR_RESERVATION - 2 }
      ]
    }));
    const model = new LolliPOPKeysModel(containerMock);
    const result = await model.upsert(aPopDocument)();
    expect(E.isLeft(result)).toBeTruthy();
    if (E.isLeft(result)) {
      expect(result.left.kind).toEqual("COSMOS_DECODING_ERROR");
    }
    expect(mockCreateItem).not.toHaveBeenCalled();
  });

  it("GIVEN a working PopModel instance and a pending popDocument, WHEN upsert is called, THEN super.upsert should be called with ttl equals to 2y", async () => {
    mockFetchAll.mockImplementationOnce(async () => ({
      resources: [
        { ...aRetrievedPopDocument, status: PopDocumentStatusEnum.PENDING }
      ]
    }));
    const model = new LolliPOPKeysModel(containerMock);
    await model.upsert(aPopDocument)();
    expect(mockCreateItem).toHaveBeenCalledWith(
      expect.objectContaining({ ttl: TTL_VALUE_AFTER_UPDATE }),
      expect.anything()
    );
  });

  it("If exist a previous version with a ttl, the new version should have a ttl with the remaining time to reach the previous one", async () => {
    const aMockedTtl = TTL_VALUE_FOR_RESERVATION;
    mockFetchAll.mockImplementationOnce(async () => ({
      resources: [{ ...aRetrievedPopDocument, ttl: aMockedTtl }]
    }));
    const model = new LolliPOPKeysModel(containerMock);
    await model.upsert(aPopDocument)();
    expect(mockCreateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        ttl:
          // eslint
          aRetrievedPopDocument._ts +
          aMockedTtl -
          mockedNowTime.getTime() / 1000
      }),
      expect.anything()
    );
  });
});
