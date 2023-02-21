import { Container } from "@azure/cosmos";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { object } from "io-ts";
import { PubKeyStatusEnum } from "../../generated/definitions/internal/PubKeyStatus";
import {
  LolliPOPKeysModel,
  PendingLolliPopPubKeys,
  TTL_VALUE_AFTER_UPDATE
} from "../../model/lollipop_keys";
import { encodeBase64 } from "../../utils/jose";
import {
  aSha512PubKey,
  aSha512PubKeyThumbprint
} from "../../__mocks__/jwkMock";
import {
  aCosmosResourceMetadata,
  aRetrievedLolliPopPubKeys,
  aPendingLolliPopPubKeys
} from "../../__mocks__/lollipopkeysMock";
import { reserveSingleKey } from "../handler";

export const mockCreateItem = jest.fn();
export const mockUpsert = jest.fn();
export const mockFetchAll = jest.fn().mockImplementation(async () => ({
  resources: []
}));

export const containerMock = ({
  items: {
    create: mockCreateItem,
    query: jest.fn(() => ({
      fetchAll: mockFetchAll
    })),
    upsert: mockUpsert
  }
} as unknown) as Container;

describe("reserveSingleKey", () => {
  test("GIVEN a working model WHEN reserve a pub_key THEN call the cosmos create and return the RetriveLollipop", async () => {
    mockFetchAll.mockImplementation(async () => ({
      resources: []
    }));
    mockCreateItem.mockImplementationOnce(
      (pendingLollipop: PendingLolliPopPubKeys) => ({
        ...pendingLollipop,
        ...aCosmosResourceMetadata,
        id: `${pendingLollipop.assertionRef}-${"0".repeat(
          16
        )}` as NonEmptyString,
        ttl: TTL_VALUE_AFTER_UPDATE,
        version: 0 as NonNegativeInteger
      })
    );
    const model = new LolliPOPKeysModel(containerMock);
    const pubKey = aSha512PubKey;
    const result = await reserveSingleKey(model)(pubKey)();
    const assertionRef = `${pubKey.algo}-${aSha512PubKeyThumbprint}`;
    expect(result).toEqual(
      expect.objectContaining({
        right: expect.objectContaining({ assertionRef })
      })
    );
    expect(mockCreateItem).toHaveBeenCalledWith({
      assertionRef,
      pubKey: encodeBase64(pubKey.pub_key),
      status: PubKeyStatusEnum.PENDING
    });
  });
});

// export const reserveSingleKey = (lollipopPubkeysModel: LolliPOPKeysModel) => (
//   inputPubkeys: NewPubKeyPayload
// ): TE.TaskEither<
//   IResponseErrorInternal | IResponseErrorConflict | IResponseErrorInternal,
//   RetrievedLolliPopPubKeys
// > =>
//   pipe(
//     inputPubkeys,
//     calculateAssertionRef,
//     TE.map(assertionRef => ({
//       assertionRef,
//       pubKey: encodeBase64(inputPubkeys.pub_key) as NonEmptyString,
//       status: PubKeyStatusEnum.PENDING as const
//     })),
//     TE.mapLeft(e => ResponseErrorInternal(e.message)),
//     TE.chainW(
//       flow(lollipopPubkeysModel.create, TE.mapLeft(cosmosErrorsToResponse))
//     )
//   );

// export const reservePubKeys = (
//   lollipopPubkeysModel: LolliPOPKeysModel
// ): Handler => (inputPubkeys): ReturnType<Handler> =>
//   pipe(
//     inputPubkeys,
//     pubKeyToAlgos,
//     RA.map(reserveSingleKey(lollipopPubkeysModel)),
//     RA.sequence(TE.ApplicativePar),
//     TE.map(reservedKeys => reservedKeys[0]),
//     TE.map(reservedKey => ({
//       assertion_ref: reservedKey.assertionRef,
//       pub_key: reservedKey.pubKey,
//       status: reservedKey.status,
//       ttl: (reservedKey.ttl ?? 0) as NonNegativeInteger,
//       version: reservedKey.version
//     })),
//     TE.map(newPubKey =>
//       ResponseSuccessRedirectToResource(
//         newPubKey,
//         "/pubKeys/{assertion_ref}",
//         newPubKey
//       )
//     ),
//     TE.toUnion
//   )();

// export const getHandler = (
//   lollipopPubkeysModel: LolliPOPKeysModel
// ): express.RequestHandler => {
//   const handler = reservePubKeys(lollipopPubkeysModel);
//   const middlewaresWrap = withRequestMiddlewares(
//     ContextMiddleware(),
//     RequiredBodyPayloadMiddleware(NewPubKeyPayload)
//   );
//   return wrapRequestHandler(
//     middlewaresWrap((_, inputPubkeys) => handler(inputPubkeys))
//   );
// };
