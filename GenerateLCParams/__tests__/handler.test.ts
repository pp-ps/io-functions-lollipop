import { GenerateLCParamsHandler } from "../handler";
import * as TE from "fp-ts/lib/TaskEither";
import * as O from "fp-ts/lib/Option";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { GenerateLcParamsPayload } from "../../generated/definitions/internal/GenerateLcParamsPayload";
import { AssertionRef } from "../../generated/definitions/internal/AssertionRef";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { PendingLolliPopPubKeys } from "../../model/lollipop_keys";
import { PubKeyStatusEnum } from "../../generated/definitions/internal/PubKeyStatus";
import { JwkPublicKey } from "@pagopa/ts-commons/lib/jwk";
import * as jose from "jose";

const contextMock = {} as any;
const defaultGracePeriod = 30 as NonNegativeInteger;

const aValidAssertionRef = "sha256-9f86d081884c7d659a2feaa0c55ad015a3bf4f1234" as AssertionRef;

const aValidGenerateLcParamsPayload: GenerateLcParamsPayload = {
  assertion_ref: aValidAssertionRef,
  operation_id: "1" as NonEmptyString
};
const aValidJwk: JwkPublicKey = {
  kty: "EC",
  crv: "P-256",
  x: "SVqB4JcUD6lsfvqMr-OKUNUphdNn64Eay60978ZlL74",
  y: "lf0u0pMj4lGAzZix5u4Cm5CMQIgMNpkwy163wtKYVKI"
};

const toEncodedJwk = (jwk: JwkPublicKey) =>
  jose.base64url.encode(JSON.stringify(jwk)) as NonEmptyString;

const aPendingLollipopPubKey: PendingLolliPopPubKeys = {
  assertionRef: aValidAssertionRef,
  pubKey: toEncodedJwk(aValidJwk),
  status: PubKeyStatusEnum.PENDING
};

const findLastVersionByModelIdMock = jest
  .fn()
  .mockImplementation(() => TE.of(O.some({})));

const lollipopKeysModelMock = {
  findLastVersionByModelId: findLastVersionByModelIdMock
} as any;

describe("GenerateLCParamsHandler", () => {
  it("GIVEN a valid input WHEN retrieve operation on cosmos fail THEN it should return an Internal server error", async () => {
    findLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.left({ kind: "COSMOS_ERROR_RESPONSE" })
    );
    const result = await GenerateLCParamsHandler(
      lollipopKeysModelMock,
      defaultGracePeriod
    )(contextMock, aValidAssertionRef, aValidGenerateLcParamsPayload);

    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseErrorInternal",
        detail: expect.stringContaining(
          "Cannot query for assertionRef on CosmosDB"
        )
      })
    );
  });

  it("GIVEN a valid input WHEN retrieve operation on cosmos returns none THEN it should return Not Found", async () => {
    findLastVersionByModelIdMock.mockImplementationOnce(() => TE.right(O.none));
    const result = await GenerateLCParamsHandler(
      lollipopKeysModelMock,
      defaultGracePeriod
    )(contextMock, aValidAssertionRef, aValidGenerateLcParamsPayload);

    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseErrorNotFound",
        detail: expect.stringContaining("AssertionRef not found")
      })
    );
  });

  it("GIVEN a valid input WHEN retrieve operation on cosmos returns a pending lollipopPubKeys THEN it should return Forbidden", async () => {
    findLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.right(O.some(aPendingLollipopPubKey))
    );
    const result = await GenerateLCParamsHandler(
      lollipopKeysModelMock,
      defaultGracePeriod
    )(contextMock, aValidAssertionRef, aValidGenerateLcParamsPayload);

    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseErrorForbiddenNotAuthorized"
      })
    );
  });
});
