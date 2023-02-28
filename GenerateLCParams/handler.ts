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
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";

import { Context } from "@azure/functions";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";

import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { flow, pipe } from "fp-ts/lib/function";
import * as dateUtils from "date-fns";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { AssertionRef } from "../generated/definitions/internal/AssertionRef";
import { LcParams } from "../generated/definitions/internal/LcParams";
import { GenerateLcParamsPayload } from "../generated/definitions/internal/GenerateLcParamsPayload";
import { getGenerateAuthJWT } from "../utils/auth_jwt";
import { isValidLollipopPubKey } from "../utils/lollipopKeys";
import { PopDocumentReader } from "../utils/readers";
import { domainErrorToResponseError } from "../utils/errors";
import { retrievedLollipopKeysToApiLcParams } from "../utils/lollipopKeys";

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
  popDocumentReader: PopDocumentReader,
  expireGracePeriodInDays: NonNegativeInteger,
  authJwtGenerator: ReturnType<typeof getGenerateAuthJWT>
): IGenerateLCParamsHandler => async (
  _,
  assertionRef,
  payload
): ReturnType<IGenerateLCParamsHandler> =>
  pipe(
    popDocumentReader(assertionRef),
    TE.mapLeft(domainErrorToResponseError),
    TE.chainW(
      flow(
        E.fromPredicate(
          isValidLollipopPubKey,
          () => ResponseErrorForbiddenNotAuthorized
        ),
        E.chain(
          E.fromPredicate(
            usedPubKeyDocument =>
              usedPubKeyDocument.expiredAt.getTime() >
              dateUtils.addDays(new Date(), -expireGracePeriodInDays).getTime(),
            () => ResponseErrorForbiddenNotAuthorized
          )
        ),
        TE.fromEither,
        TE.bindTo("activePubKey"),
        TE.bindW("lcAuthJwt", () =>
          pipe(
            authJwtGenerator({
              assertionRef,
              operationId: payload.operation_id
            }),
            TE.mapLeft(e =>
              ResponseErrorInternal(
                `Cannot generate LC Auth JWT|ERROR=${e.message}`
              )
            )
          )
        ),
        TE.map(({ activePubKey, lcAuthJwt }) =>
          ResponseSuccessJson(
            retrievedLollipopKeysToApiLcParams(activePubKey, lcAuthJwt)
          )
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
  popDocumentReader: PopDocumentReader,
  expireGracePeriodInDays: NonNegativeInteger,
  authJwtGenerator: ReturnType<typeof getGenerateAuthJWT>
): express.RequestHandler {
  const handler = GenerateLCParamsHandler(
    popDocumentReader,
    expireGracePeriodInDays,
    authJwtGenerator
  );
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    RequiredParamMiddleware("assertion_ref", AssertionRef),
    RequiredBodyPayloadMiddleware(GenerateLcParamsPayload)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
