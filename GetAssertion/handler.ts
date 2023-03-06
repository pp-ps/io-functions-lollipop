import * as express from "express";

import * as TE from "fp-ts/lib/TaskEither";
import { flow, pipe } from "fp-ts/lib/function";

import {
  AzureApiAuthMiddleware,
  IAzureApiAuthorization,
  UserGroup
} from "@pagopa/io-functions-commons/dist/src/utils/middlewares/azure_api_auth";
import { RequiredParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_param";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";

import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorGone,
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorForbiddenNotAuthorized,
  ResponseErrorGone,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";

import { Context } from "@azure/functions";

import { AssertionRef } from "../generated/definitions/internal/AssertionRef";
import { LCUserInfo } from "../generated/definitions/external/LCUserInfo";
import { PubKeyStatusEnum } from "../generated/definitions/internal/PubKeyStatus";

import { AssertionReader, PublicKeyDocumentReader } from "../utils/readers";
import { AuthJWT, verifyJWTMiddleware } from "../utils/auth_jwt";
import { isNotPendingLollipopPubKey } from "../utils/lollipopKeys";
import { DomainError, ErrorKind, logAndReturnResponse } from "../utils/errors";
import { JWTConfig } from "../utils/config";

const domainErrorToResponseError = (
  error: DomainError
): IResponseErrorGone | IResponseErrorInternal =>
  error.kind === ErrorKind.NotFound
    ? ResponseErrorGone("Resource gone")
    : ResponseErrorInternal(error.detail);

/**
 * Type of a GetAssertion handler
 */

type IGetAssertionHandler = (
  context: Context,
  auth: IAzureApiAuthorization,
  assertionRef: AssertionRef,
  authJwtPayload: AuthJWT
) => Promise<
  | IResponseSuccessJson<LCUserInfo>
  | IResponseErrorValidation
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorInternal
  | IResponseErrorGone
>;
/**
 * Handles requests for retrieve a SPID/OIDC Assertion.
 */
export const GetAssertionHandler = (
  publicKeyDocumentReader: PublicKeyDocumentReader,
  assertionReader: AssertionReader
): IGetAssertionHandler => async (
  context,
  _apiAuth,
  assertionRef,
  authJwtPayload
): ReturnType<IGetAssertionHandler> =>
  pipe(
    assertionRef,
    TE.fromPredicate(
      ar => ar === authJwtPayload.assertionRef,
      () =>
        logAndReturnResponse(
          context,
          ResponseErrorForbiddenNotAuthorized,
          `jwt assertion_ref does not match the one in path`
        )
    ),
    TE.chainW(
      flow(
        publicKeyDocumentReader,
        TE.mapLeft(error =>
          logAndReturnResponse(
            context,
            domainErrorToResponseError(error),
            `Error while reading pop document: ${
              error.kind === ErrorKind.Internal
                ? ` ${error.message}`
                : error.kind
            }`
          )
        ),
        TE.filterOrElseW(isNotPendingLollipopPubKey, () =>
          logAndReturnResponse(
            context,
            ResponseErrorInternal("Unexpected status on pubKey document"),
            `Unexpected ${PubKeyStatusEnum.PENDING} status on pubKey document`
          )
        )
      )
    ),
    TE.chainW(({ assertionFileName }) =>
      pipe(
        assertionReader(assertionFileName),
        TE.mapLeft(error =>
          logAndReturnResponse(
            context,
            domainErrorToResponseError(error),
            `Error while reading assertion from blob storage: ${
              error.kind === ErrorKind.Internal
                ? `${error.message}`
                : error.kind
            }`
          )
        ),
        // TODO: add OIDC assertion type management
        TE.map(assertion =>
          ResponseSuccessJson({
            response_xml: assertion
          })
        )
      )
    ),
    TE.toUnion
  )();

/**
 * Wraps a GetAssertion handler inside an Express request handler.
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function GetAssertion(
  jwtConfig: JWTConfig,
  publicKeyDocumentReader: PublicKeyDocumentReader,
  assertionReader: AssertionReader
): express.RequestHandler {
  const handler = GetAssertionHandler(publicKeyDocumentReader, assertionReader);
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    AzureApiAuthMiddleware(new Set([UserGroup.ApiLollipopAssertionRead])),
    RequiredParamMiddleware("assertion_ref", AssertionRef),
    verifyJWTMiddleware(jwtConfig)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
