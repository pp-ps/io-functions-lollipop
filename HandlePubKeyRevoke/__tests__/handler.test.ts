import { Context } from "@azure/functions";
import * as TE from "fp-ts/TaskEither";
import * as O from "fp-ts/Option";
import { toPermanentFailure, TransientFailure } from "../../utils/errors";
import { handleRevoke } from "../handler";
import { AssertionRefSha256 } from "../../generated/definitions/internal/AssertionRefSha256";
import { RevokeAssertionRefInfo } from "@pagopa/io-functions-commons/dist/src/entities/revoke_assertion_ref_info";
import { AssertionRef } from "../../generated/definitions/internal/AssertionRef";
import { toCosmosErrorResponse } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";

const contextMock = {
  log: {
    error: jest.fn()
  },
  executionContext: {}
} as any;

const mockAppinsights = {
  trackEvent: jest.fn().mockReturnValue(void 0),
  trackException: jest.fn().mockReturnValue(void 0)
};

const aValidAssertionRef = "sha256-9f86d081884c7d659a2feaa0c55ad015a3bf4f1234" as AssertionRef;

const aValidRevokeInput: RevokeAssertionRefInfo = {
  assertion_ref: aValidAssertionRef
};
const aTransientFailure: TransientFailure = {
  kind: "TRANSIENT",
  reason: "aReason"
};

const findLastVersionByModelIdMock = jest
  .fn()
  .mockImplementation(() => TE.of(O.some({})));

const upsertMock = jest.fn().mockImplementation(() => TE.of({}));
const lollipopKeysModelMock = {
  findLastVersionByModelId: findLastVersionByModelIdMock,
  upsert: upsertMock
} as any;

describe("handleRevoke", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GIVEN a malformed revoke message WHEN decoding input THEN it should return a Permanent Failure", async () => {
    const result = await handleRevoke(
      contextMock,
      mockAppinsights as any,
      lollipopKeysModelMock,
      "wrong input"
    );

    expect(mockAppinsights.trackException).toHaveBeenCalled();
    expect(mockAppinsights.trackException).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: {
          detail: "PERMANENT",
          fatal: "true",
          isSuccess: "false",
          modelId: "",
          name: "lollipop.pubKeys.revoke.failure"
        }
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        kind: "PERMANENT"
      })
    );
  });

  it("GIVEN a valid revoke message WHEN findLastVersion fails THEN it should throw with a transient failure", async () => {
    findLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.left(toCosmosErrorResponse("Cannot reach cosmosDB"))
    );
    await expect(
      handleRevoke(
        contextMock,
        mockAppinsights as any,
        lollipopKeysModelMock,
        aValidRevokeInput
      )
    ).rejects.toBeDefined();

    expect(mockAppinsights.trackException).toHaveBeenCalled();
    expect(mockAppinsights.trackException).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: {
          detail: "TRANSIENT",
          fatal: "false",
          isSuccess: "false",
          modelId: "",
          name: "lollipop.pubKeys.revoke.failure"
        }
      })
    );
    expect(findLastVersionByModelIdMock).toHaveBeenCalledTimes(1);
    expect(findLastVersionByModelIdMock).toHaveBeenCalledWith([
      aValidRevokeInput.assertion_ref
    ]);
  });

  it("GIVEN a valid revoke message WHEN findLastVersion returns none THEN it should success wihout perform any upsert", async () => {
    findLastVersionByModelIdMock.mockImplementationOnce(() => TE.right(O.none));
    const result = await handleRevoke(
      contextMock,
      mockAppinsights as any,
      lollipopKeysModelMock,
      aValidRevokeInput
    );

    expect(mockAppinsights.trackException).not.toHaveBeenCalled();
    expect(findLastVersionByModelIdMock).toHaveBeenCalledTimes(1);
    expect(findLastVersionByModelIdMock).toHaveBeenCalledWith([
      aValidRevokeInput.assertion_ref
    ]);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
