import { GenerateLCParamsHandler } from "../handler";
import * as TE from "fp-ts/lib/TaskEither";
import * as O from "fp-ts/lib/Option";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { GenerateLcParamsPayload } from "../../generated/definitions/internal/GenerateLcParamsPayload";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  NotPendingLolliPopPubKeys,
  TTL_VALUE_AFTER_UPDATE
} from "../../model/lollipop_keys";
import {
  aLolliPopPubKeys,
  anAssertionRef,
  aPendingLolliPopPubKeys,
  aRetrievedLolliPopPubKeys
} from "../../__mocks__/lollipopkeysMock";
import * as date_fns from "date-fns";
import { PopDocumentReader } from "../../utils/readers";
import { ErrorKind } from "../../utils/errors";

const anAuthJwt = "anAuthJwt" as NonEmptyString;
const contextMock = {} as any;
const defaultGracePeriod = 30 as NonNegativeInteger;
const anExpiredOutOfGracePeriodDate = date_fns.addDays(
  new Date(),
  -defaultGracePeriod - 1
);
const anExpiredInGracePeriodDate = date_fns.addDays(
  new Date(),
  -defaultGracePeriod + 1
);

const aValidGenerateLcParamsPayload: GenerateLcParamsPayload = {
  operation_id: "1" as NonEmptyString
};

const aValidRetrievedLollipopPubKey: NotPendingLolliPopPubKeys = {
  ...aRetrievedLolliPopPubKeys,
  ...aLolliPopPubKeys
};

const popDocumentReaderMock = jest
  .fn()
  .mockImplementation(
    () => TE.of(aValidRetrievedLollipopPubKey) as ReturnType<PopDocumentReader>
  );
const anAuthJwtGeneratorMock = jest
  .fn()
  .mockImplementation(_ => TE.of(anAuthJwt));

describe("GenerateLCParamsHandler", () => {
  it("GIVEN a valid input WHEN retrieve operation on cosmos fail THEN it should return an Internal server error", async () => {
    popDocumentReaderMock.mockImplementationOnce(() =>
      TE.left({ kind: ErrorKind.Internal, detail: "COSMOS_ERROR_RESPONSE" })
    );
    const result = await GenerateLCParamsHandler(
      popDocumentReaderMock,
      defaultGracePeriod,
      anAuthJwtGeneratorMock
    )(contextMock, anAssertionRef, aValidGenerateLcParamsPayload);

    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseErrorInternal",
        detail: expect.stringContaining("COSMOS_ERROR_RESPONSE")
      })
    );
  });

  it("GIVEN a valid input WHEN retrieve operation on cosmos returns none THEN it should return Not Found", async () => {
    popDocumentReaderMock.mockImplementationOnce(() =>
      TE.left({ kind: ErrorKind.NotFound })
    );
    const result = await GenerateLCParamsHandler(
      popDocumentReaderMock,
      defaultGracePeriod,
      anAuthJwtGeneratorMock
    )(contextMock, anAssertionRef, aValidGenerateLcParamsPayload);

    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseErrorNotFound",
        detail: "NotFound: Could not find requested resource"
      })
    );
  });

  it("GIVEN a valid input WHEN retrieve operation on cosmos returns a pending lollipopPubKeys THEN it should return Forbidden", async () => {
    popDocumentReaderMock.mockImplementationOnce(() =>
      TE.right(aPendingLolliPopPubKeys)
    );
    const result = await GenerateLCParamsHandler(
      popDocumentReaderMock,
      defaultGracePeriod,
      anAuthJwtGeneratorMock
    )(contextMock, anAssertionRef, aValidGenerateLcParamsPayload);

    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseErrorForbiddenNotAuthorized"
      })
    );
  });

  it("GIVEN a valid input WHEN retrieve operation on cosmos returns an expired lollipopPubKeys THEN it should return Forbidden", async () => {
    popDocumentReaderMock.mockImplementationOnce(() =>
      TE.right({
        ...aValidRetrievedLollipopPubKey,
        expiredAt: anExpiredOutOfGracePeriodDate
      })
    );
    const result = await GenerateLCParamsHandler(
      popDocumentReaderMock,
      defaultGracePeriod,
      anAuthJwtGeneratorMock
    )(contextMock, anAssertionRef, aValidGenerateLcParamsPayload);

    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseErrorForbiddenNotAuthorized"
      })
    );
  });

  it("GIVEN a valid input WHEN LC auth Jwt generation fails THEN returns Internal Server Error", async () => {
    popDocumentReaderMock.mockImplementationOnce(() =>
      TE.right(aValidRetrievedLollipopPubKey)
    );
    anAuthJwtGeneratorMock.mockImplementationOnce(() =>
      TE.left(Error("Cannot generate JWT"))
    );

    const result = await GenerateLCParamsHandler(
      popDocumentReaderMock,
      defaultGracePeriod,
      anAuthJwtGeneratorMock
    )(contextMock, anAssertionRef, aValidGenerateLcParamsPayload);

    expect(anAuthJwtGeneratorMock).toHaveBeenCalledWith({
      assertionRef: anAssertionRef,
      operationId: aValidGenerateLcParamsPayload.operation_id
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseErrorInternal"
      })
    );
  });

  it("GIVEN a valid input WHEN retrieve operation on cosmos returns an expired lollipopPubKeys in gracePeriod THEN it should return success", async () => {
    popDocumentReaderMock.mockImplementationOnce(() =>
      TE.right({
        ...aValidRetrievedLollipopPubKey,
        expiredAt: anExpiredInGracePeriodDate
      })
    );
    const result = await GenerateLCParamsHandler(
      popDocumentReaderMock,
      defaultGracePeriod,
      anAuthJwtGeneratorMock
    )(contextMock, anAssertionRef, aValidGenerateLcParamsPayload);

    expect(anAuthJwtGeneratorMock).toHaveBeenCalledWith({
      assertionRef: anAssertionRef,
      operationId: aValidGenerateLcParamsPayload.operation_id
    });
    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseSuccessJson"
      })
    );
  });

  it("GIVEN a valid input WHEN retrieve operation on cosmos returns a valid lollipopPubKeys THEN it should return success", async () => {
    popDocumentReaderMock.mockImplementationOnce(() =>
      TE.right(aValidRetrievedLollipopPubKey)
    );
    const result = await GenerateLCParamsHandler(
      popDocumentReaderMock,
      defaultGracePeriod,
      anAuthJwtGeneratorMock
    )(contextMock, anAssertionRef, aValidGenerateLcParamsPayload);

    expect(anAuthJwtGeneratorMock).toHaveBeenCalledWith({
      assertionRef: anAssertionRef,
      operationId: aValidGenerateLcParamsPayload.operation_id
    });
    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseSuccessJson",
        value: expect.objectContaining({
          assertion_file_name: aValidRetrievedLollipopPubKey.assertionFileName,
          assertion_ref: aValidRetrievedLollipopPubKey.assertionRef,
          assertion_type: aValidRetrievedLollipopPubKey.assertionType,
          fiscal_code: aValidRetrievedLollipopPubKey.fiscalCode,
          lc_authentication_bearer: anAuthJwt,
          pub_key: aValidRetrievedLollipopPubKey.pubKey,
          status: aValidRetrievedLollipopPubKey.status,
          ttl: TTL_VALUE_AFTER_UPDATE
        })
      })
    );
  });
});
