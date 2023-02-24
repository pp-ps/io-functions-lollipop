import * as express from "express";

import { RequiredParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_param";
import { RequiredBodyPayloadMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_body_payload";

import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";

import { Context } from "@azure/functions";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";

import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import { flow, pipe } from "fp-ts/lib/function";
import * as t from "io-ts";
import * as dateUtils from "date-fns";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { AssertionRef } from "../generated/definitions/internal/AssertionRef";
import { LcParams } from "../generated/definitions/internal/LcParams";
import { GenerateLcParamsPayload } from "../generated/definitions/internal/GenerateLcParamsPayload";
import {
  LolliPOPKeysModel,
  RetrievedLolliPopPubKeys
} from "../model/lollipop_keys";
import { PubKeyStatusEnum } from "../generated/definitions/internal/PubKeyStatus";

// TODO Refactor after other PR merge
const ValidRetrievedLolliPopPubKeys = t.intersection([
  RetrievedLolliPopPubKeys,
  t.type({
    status: t.literal(PubKeyStatusEnum.VALID)
  })
]);

type ValidRetrievedLolliPopPubKeys = t.TypeOf<
  typeof ValidRetrievedLolliPopPubKeys
>;

/**
 * Type of a GenerateLCParams handler
 */

type IGenerateLCParamsHandler = (
  context: Context,
  assertionRef: AssertionRef,
  payload: GenerateLcParamsPayload
) => Promise<
  | IResponseSuccessJson<LcParams>
  | IResponseErrorValidation
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorNotFound
  | IResponseErrorInternal
>;
/**
 * Handles requests for generating Lollipop Consumer required params.
 */
export const GenerateLCParamsHandler = (
  lollipopKeysModel: LolliPOPKeysModel,
  expireGracePeriodInDays: NonNegativeInteger
): IGenerateLCParamsHandler => async (
  _,
  assertionRef,
  payload
): ReturnType<IGenerateLCParamsHandler> =>
  pipe(
    lollipopKeysModel.findLastVersionByModelId([assertionRef]),
    TE.mapLeft(e =>
      ResponseErrorInternal(
        `Cannot query for assertionRef on CosmosDB|ERROR=${JSON.stringify(e)}`
      )
    ),
    TE.chainW(
      TE.fromOption(() =>
        ResponseErrorNotFound("AssertionRef not found", "Not Found")
      )
    ),
    TE.chainW(
      flow(
        ValidRetrievedLolliPopPubKeys.decode,
        E.mapLeft(() => ResponseErrorForbiddenNotAuthorized),
        E.chain(
          E.fromPredicate(
            usedPubKeyDocument =>
              usedPubKeyDocument.expiredAt.getTime() >
              dateUtils.addDays(new Date(), -expireGracePeriodInDays).getTime(),
            () => ResponseErrorForbiddenNotAuthorized
          )
        ),
        TE.fromEither,
        TE.map(activePubKey =>
          ResponseSuccessJson({
            assertion_file_name: `${activePubKey.assertionFileName}` as NonEmptyString,
            assertion_ref: activePubKey.assertionRef,
            assertion_type: activePubKey.assertionType,
            expired_at: activePubKey.expiredAt,
            fiscal_code: activePubKey.fiscalCode,
            // generateJWT here
            lc_authentication_bearer: payload.operation_id,
            pub_key: activePubKey.pubKey,
            status: activePubKey.status,
            ttl: pipe(
              activePubKey.ttl,
              O.fromNullable,
              O.chainEitherK(NonNegativeInteger.decode),
              O.getOrElse(() => 0 as NonNegativeInteger)
            ),
            version: activePubKey.version
          })
        )
      )
    ),
    TE.toUnion
  )();

/**
 * Wraps a GenerateLCParamsHandler handler inside an Express request handler.
 */
// eslint-disable-next-line max-params, prefer-arrow/prefer-arrow-functions
export function GenerateLCParams(
  lollipopKeysModel: LolliPOPKeysModel,
  expireGracePeriodInDays: NonNegativeInteger
): express.RequestHandler {
  const handler = GenerateLCParamsHandler(
    lollipopKeysModel,
    expireGracePeriodInDays
  );
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    RequiredParamMiddleware("assertion_ref", AssertionRef),
    RequiredBodyPayloadMiddleware(GenerateLcParamsPayload)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
