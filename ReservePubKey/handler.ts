import * as express from "express";
import { withRequestMiddlewares } from "@pagopa/ts-commons/lib/request_middleware";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { RequiredBodyPayloadMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_body_payload";
import { wrapRequestHandler } from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorConflict,
  IResponseErrorInternal,
  IResponseSuccessRedirectToResource,
  ResponseErrorConflict,
  ResponseErrorInternal,
  ResponseSuccessRedirectToResource
} from "@pagopa/ts-commons/lib/responses";
import { pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { encodeBase64 } from "../utils/jose";
import { calculateAssertionRef, pubKeyToAlgos } from "../utils/pubkeys";
import { NewPubKey } from "../generated/definitions/internal/NewPubKey";
import { NewPubKeyPayload } from "../generated/definitions/internal/NewPubKeyPayload";
import {
  LolliPOPKeysModel,
  RetrievedLolliPopPubKeys
} from "../model/lollipop_keys";
import { PubKeyStatusEnum } from "../generated/definitions/internal/PubKeyStatus";

type Handler = (
  inputPubkeys: NewPubKeyPayload
) => Promise<
  | IResponseSuccessRedirectToResource<NewPubKey, NewPubKey>
  | IResponseErrorConflict
  | IResponseErrorInternal
>;

const cosmosErrorsToResponse = (
  error: CosmosErrors
): IResponseErrorConflict | IResponseErrorInternal =>
  error.kind === "COSMOS_CONFLICT_RESPONSE"
    ? ResponseErrorConflict("A lollipop pubKey has been already reserved")
    : ResponseErrorInternal(JSON.stringify(error));

export const reserveSingleKey = (lollipopPubkeysModel: LolliPOPKeysModel) => (
  inputPubkeys: NewPubKeyPayload
): TE.TaskEither<
  IResponseErrorInternal | IResponseErrorConflict | IResponseErrorInternal,
  RetrievedLolliPopPubKeys
> =>
  pipe(
    inputPubkeys,
    calculateAssertionRef,
    TE.map(assertionRef => ({
      assertionRef,
      pubKey: encodeBase64(inputPubkeys.pub_key) as NonEmptyString,
      status: PubKeyStatusEnum.PENDING as const
    })),
    TE.mapLeft(e => ResponseErrorInternal(e.message)),
    TE.chain(pendingPubKey =>
      pipe(
        lollipopPubkeysModel.create(pendingPubKey),
        TE.mapLeft(cosmosErrorsToResponse)
      )
    )
  );

export const reservePubKeys = (
  lollipopPubkeysModel: LolliPOPKeysModel
): Handler => (inputPubkeys): ReturnType<Handler> =>
  pipe(
    inputPubkeys,
    pubKeyToAlgos,
    RA.map(reserveSingleKey(lollipopPubkeysModel)),
    RA.sequence(TE.ApplicativePar),
    TE.map(reservedKeys => reservedKeys[0]),
    TE.map(reservedKey => ({
      assertion_ref: reservedKey.assertionRef,
      pub_key: reservedKey.pubKey,
      status: reservedKey.status,
      ttl: (reservedKey.ttl ?? 0) as NonNegativeInteger,
      version: reservedKey.version
    })),
    TE.map(newPubKey =>
      ResponseSuccessRedirectToResource(
        newPubKey,
        `/pubKeys/${newPubKey.assertion_ref}`,
        newPubKey
      )
    ),
    TE.toUnion
  )();

export const getHandler = (
  lollipopPubkeysModel: LolliPOPKeysModel
): express.RequestHandler => {
  const handler = reservePubKeys(lollipopPubkeysModel);
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    RequiredBodyPayloadMiddleware(NewPubKeyPayload)
  );
  return wrapRequestHandler(
    middlewaresWrap((_, inputPubkeys) => handler(inputPubkeys))
  );
};
