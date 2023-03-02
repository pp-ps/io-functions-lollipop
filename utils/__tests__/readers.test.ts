import { ErrorResponse } from "@azure/cosmos";
import { BlobService, StorageError } from "azure-storage";

import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";

import * as fn_commons from "@pagopa/io-functions-commons/dist/src/utils/azure_storage";

import { LolliPOPKeysModel } from "../../model/lollipop_keys";
import { getAssertionReader, getPopDocumentReader } from "../readers";

import {
  aRetrievedPendingLollipopPubKeySha256,
  aValidSha256AssertionRef
} from "../../__mocks__/lollipopPubKey.mock";
import { anAssertionFileName } from "../../__mocks__/lollipopkeysMock";
import { blobServiceMock } from "../../__mocks__/blobService.mock";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

const anAssertionContent = "an Assertion";

// --------------------------
// Mocks
// --------------------------

const findLastVersionByModelIdMock = jest
  .fn()
  .mockImplementation(() =>
    TE.of(O.some(aRetrievedPendingLollipopPubKeySha256))
  );

const upsertMock = jest.fn().mockImplementation(() => TE.of({}));

const lollipopPubKeysModelMock = ({
  findLastVersionByModelId: findLastVersionByModelIdMock,
  upsert: upsertMock
} as unknown) as LolliPOPKeysModel;

const getBlobAsTextWithErrorMock = jest.spyOn(
  fn_commons,
  "getBlobAsTextWithError"
);
getBlobAsTextWithErrorMock.mockImplementation(
  (blobService, containerName) => assertionName =>
    TE.right(O.fromNullable(anAssertionContent))
);

// --------------------------
// Tests
// --------------------------

describe("PopDocumentReader", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return the existing popDocument", async () => {
    const popDocumentReader = getPopDocumentReader(lollipopPubKeysModelMock);

    const result = await popDocumentReader(aValidSha256AssertionRef)();
    expect(result).toEqual(E.right(aRetrievedPendingLollipopPubKeySha256));
  });

  it("should return NotFound if document does not exists", async () => {
    findLastVersionByModelIdMock.mockImplementationOnce(() => TE.of(O.none));
    const popDocumentReader = getPopDocumentReader(lollipopPubKeysModelMock);

    const result = await popDocumentReader(aValidSha256AssertionRef)();
    expect(result).toMatchObject(
      E.left({
        kind: "NotFound"
      })
    );
  });

  it("should return InternalError if an error occurred retrieving the document", async () => {
    findLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.left({
        kind: "COSMOS_ERROR_RESPONSE",
        error: { message: "an Error" } as ErrorResponse
      })
    );
    const popDocumentReader = getPopDocumentReader(lollipopPubKeysModelMock);

    const result = await popDocumentReader(aValidSha256AssertionRef)();
    expect(result).toEqual(
      E.left({
        kind: "Internal",
        detail: 'Generic error: {"message":"an Error"}'
      })
    );
  });
});

describe("AssertionReader", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return the existing assertion", async () => {
    const assertionReader = getAssertionReader(
      blobServiceMock,
      "aContainerName" as NonEmptyString
    );

    const result = await assertionReader(anAssertionFileName)();
    expect(result).toEqual(E.right(anAssertionContent));
  });

  it("should return an internal error when an error occurred retrieving the assertion from blob storage", async () => {
    getBlobAsTextWithErrorMock.mockImplementationOnce(() => () =>
      TE.left(({ message: "an Error" } as unknown) as StorageError)
    );

    const assertionReader = getAssertionReader(
      blobServiceMock,
      "aContainerName" as NonEmptyString
    );

    const result = await assertionReader(anAssertionFileName)();
    expect(result).toEqual(
      E.left({
        kind: "Internal",
        detail: `Unable to retrieve assertion ${anAssertionFileName} from blob storage: an Error`
      })
    );
  });

  it("should return an internal error when the assertion content is empty", async () => {
    getBlobAsTextWithErrorMock.mockImplementationOnce(() => () =>
      TE.right(O.fromNullable(""))
    );

    const assertionReader = getAssertionReader(
      blobServiceMock,
      "aContainerName" as NonEmptyString
    );

    const result = await assertionReader(anAssertionFileName)();
    expect(result).toEqual(
      E.left({
        kind: "Internal",
        detail: `Assertion ${anAssertionFileName} is empty`
      })
    );
  });

  it("should return a not found error when there no assertion was found in blob storage for a given assertion file name", async () => {
    getBlobAsTextWithErrorMock.mockImplementationOnce(() => () =>
      TE.right(O.none)
    );

    const assertionReader = getAssertionReader(
      blobServiceMock,
      "aContainerName" as NonEmptyString
    );

    const result = await assertionReader(anAssertionFileName)();
    expect(result).toEqual(
      E.left({
        kind: "NotFound"
      })
    );
  });
});
