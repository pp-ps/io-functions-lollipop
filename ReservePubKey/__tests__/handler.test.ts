import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { JwkPubKeyHashAlgorithmEnum } from "../../generated/definitions/internal/JwkPubKeyHashAlgorithm";
import { PubKeyStatusEnum } from "../../generated/definitions/internal/PubKeyStatus";
import {
  LolliPOPKeysModel,
  PendingLolliPopPubKeys,
  TTL_VALUE_FOR_RESERVATION
} from "../../model/lollipop_keys";
import { encodeBase64 } from "../../utils/thumbprint";
import { MASTER_HASH_ALGO } from "../../utils/lollipopKeys";
import {
  aSha256PubKeyThumbprint,
  aSha512PubKey,
  aSha512PubKeyThumbprint
} from "../../__mocks__/jwkMock";
import {
  aCosmosResourceMetadata,
  mockContainer
} from "../../__mocks__/lollipopkeysMock";
import * as handler from "../handler";
import { AssertionRef } from "../../generated/definitions/external/AssertionRef";

const mockCreatePendingLollipop = (pendingLollipop: PendingLolliPopPubKeys) =>
  Promise.resolve({
    resource: {
      ...pendingLollipop,
      ...aCosmosResourceMetadata,
      id: `${pendingLollipop.assertionRef}-${"0".repeat(16)}` as NonEmptyString,
      ttl: TTL_VALUE_FOR_RESERVATION,
      version: 0 as NonNegativeInteger
    }
  });

describe("reserveSingleKey", () => {
  test("GIVEN a working model WHEN reserve a pub_key THEN call the cosmos create and return the RetriveLollipop", async () => {
    const mockedContainer = mockContainer();
    mockedContainer.mock.create.mockImplementation(mockCreatePendingLollipop);

    const model = new LolliPOPKeysModel(mockedContainer.container);
    const pubKey = aSha512PubKey;
    const assertionRef = `${pubKey.algo}-${aSha512PubKeyThumbprint}` as AssertionRef;
    const result = await handler.reserveSingleKey(
      model,
      pubKey.pub_key
    )(assertionRef)();
    expect(result).toEqual(
      expect.objectContaining({
        right: expect.objectContaining({ assertionRef })
      })
    );
    expect(mockedContainer.mock.create).toHaveBeenCalledWith(
      {
        assertionRef,
        pubKey: encodeBase64(pubKey.pub_key),
        status: PubKeyStatusEnum.PENDING,
        id: `${assertionRef}-0000000000000000`,
        ttl: TTL_VALUE_FOR_RESERVATION,
        version: 0
      },
      expect.anything()
    );
  });

  test("GIVEN a not working model WHEN reserve a pub_key THEN return an Internal Error Response containing a Cosmos Error", async () => {
    const mockedContainer = mockContainer();
    mockedContainer.mock.create.mockImplementation(() => "");

    const model = new LolliPOPKeysModel(mockedContainer.container);
    const pubKey = aSha512PubKey;
    const assertionRef = `${pubKey.algo}-${aSha512PubKeyThumbprint}` as AssertionRef;
    const result = await handler.reserveSingleKey(
      model,
      pubKey.pub_key
    )(assertionRef)();

    expect(result).toEqual(
      expect.objectContaining({
        left: expect.objectContaining({
          kind: "IResponseErrorInternal",
          detail: expect.stringContaining("COSMOS_ERROR_RESPONSE")
        })
      })
    );
  });
});

describe("reservePubKeys", () => {
  test("GIVEN a working model WHEN reserve a master pub_key THEN store it and return a redirect containing the assertion ref ", async () => {
    const mockedContainer = mockContainer();
    mockedContainer.mock.create.mockImplementation(mockCreatePendingLollipop);
    const model = new LolliPOPKeysModel(mockedContainer.container);
    const pubKey = aSha512PubKey;
    const result = await handler.reservePubKeys(model)(pubKey);
    const assertionRef = `${pubKey.algo}-${aSha512PubKeyThumbprint}`;
    expect(mockedContainer.mock.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseSuccessRedirectToResource",
        detail: `/pubKeys/${assertionRef}`,
        payload: expect.objectContaining({
          assertion_ref: assertionRef,
          pub_key: encodeBase64(pubKey.pub_key)
        }),
        resource: expect.objectContaining({ assertion_ref: assertionRef })
      })
    );
  });

  test("GIVEN a working model WHEN reserve a non-master pub_key THEN store both master and non-master pub_key and return a redirect containing the assertion ref ", async () => {
    const mockedContainer = mockContainer();
    mockedContainer.mock.create.mockImplementation(mockCreatePendingLollipop);
    const model = new LolliPOPKeysModel(mockedContainer.container);
    const pubKey = {
      ...aSha512PubKey,
      algo: JwkPubKeyHashAlgorithmEnum.sha256
    };
    const result = await handler.reservePubKeys(model)(pubKey);
    const assertionRef = `${pubKey.algo}-${aSha256PubKeyThumbprint}`;
    const masterAssertionRef = `${MASTER_HASH_ALGO}-${aSha512PubKeyThumbprint}`;
    expect(mockedContainer.mock.create).toHaveBeenCalledTimes(2);
    expect(mockedContainer.mock.create).toHaveBeenCalledWith(
      expect.objectContaining({ assertionRef: masterAssertionRef }),
      expect.anything()
    );
    expect(mockedContainer.mock.create).toHaveBeenCalledWith(
      expect.objectContaining({ assertionRef }),
      expect.anything()
    );
    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseSuccessRedirectToResource",
        detail: `/pubKeys/${assertionRef}`,
        payload: expect.objectContaining({
          assertion_ref: assertionRef,
          pub_key: encodeBase64(pubKey.pub_key)
        }),
        resource: expect.objectContaining({ assertion_ref: assertionRef })
      })
    );
  });

  test("GIVEN a not working model WHEN reserve a master pub_key THEN return an internal error response containing a Cosmos Error", async () => {
    const mockedContainer = mockContainer();
    mockedContainer.mock.create.mockImplementation(() => "");
    const model = new LolliPOPKeysModel(mockedContainer.container);
    const pubKey = aSha512PubKey;
    const result = await handler.reservePubKeys(model)(pubKey);
    expect(mockedContainer.mock.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseErrorInternal",
        detail: expect.stringContaining("COSMOS_ERROR_RESPONSE")
      })
    );
  });

  test("GIVEN a not working model WHEN reserve a non-master pub_key THEN return an internal error response containing a Cosmos Error", async () => {
    const mockedContainer = mockContainer();
    mockedContainer.mock.create.mockImplementation(() => "");
    const model = new LolliPOPKeysModel(mockedContainer.container);
    const pubKey = {
      ...aSha512PubKey,
      algo: JwkPubKeyHashAlgorithmEnum.sha256
    };
    const result = await handler.reservePubKeys(model)(pubKey);
    expect(mockedContainer.mock.create).toHaveBeenCalledTimes(2);
    expect(result).toEqual(
      expect.objectContaining({
        kind: "IResponseErrorInternal",
        detail: expect.stringContaining("COSMOS_ERROR_RESPONSE")
      })
    );
  });
});
