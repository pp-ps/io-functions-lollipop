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

import { AssertionReader, PopDocumentReader } from "../utils/readers";
import { AuthJWT, verifyJWTMiddleware } from "../utils/auth_jwt";
import { isNotPendingLollipopPubKey } from "../utils/lollipopKeys";
import { DomainError, ErrorKind } from "../utils/errors";
import { JWTConfig } from "../utils/config";

const domainErrorToResponseError = (
  error: DomainError
): IResponseErrorGone | IResponseErrorInternal =>
  error.kind === ErrorKind.NotFound
    ? ResponseErrorGone("")
    : ResponseErrorInternal(error.detail);

/**
 * Type of a GetAssertion handler
 */

type IGetAssertionHandler = (
  context: Context,
  auth: IAzureApiAuthorization,
  assertionRef: AssertionRef,
  jwt: AuthJWT
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
  popDocumentReader: PopDocumentReader,
  assertionReader: AssertionReader
): IGetAssertionHandler => async (
  context,
  _apiAuth,
  assertionRef,
  jwt
): ReturnType<IGetAssertionHandler> =>
  pipe(
    assertionRef,
    TE.fromPredicate(
      ar => ar === jwt.assertionRef,
      () => ResponseErrorForbiddenNotAuthorized
    ),
    TE.chainW(
      flow(
        popDocumentReader,
        TE.mapLeft(error => {
          // TODO after rebase
          const err = `Error while reading pop document: ${error.kind}`;
          context.log.error(err);
          return domainErrorToResponseError(error);
        }),
        TE.filterOrElseW(isNotPendingLollipopPubKey, () => {
          const err = `Unexpected ${PubKeyStatusEnum.PENDING} status on pop document`;
          context.log.error(err);
          return ResponseErrorForbiddenNotAuthorized;
        })
      )
    ),
    TE.chainW(({ assertionFileName }) =>
      pipe(
        assertionReader(assertionFileName),
        TE.mapLeft(domainErrorToResponseError),
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
// eslint-disable-next-line max-params, prefer-arrow/prefer-arrow-functions
export function GetAssertion(
  jwtConfig: JWTConfig,
  popDocumentReader: PopDocumentReader,
  assertionReader: AssertionReader
): express.RequestHandler {
  const handler = GetAssertionHandler(popDocumentReader, assertionReader);
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    AzureApiAuthMiddleware(new Set([UserGroup.ApiLollipopAssertionRead])),
    RequiredParamMiddleware("assertion_ref", AssertionRef),
    verifyJWTMiddleware(jwtConfig)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
