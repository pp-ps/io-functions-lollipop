import * as express from "express";

import { RequiredParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_param";

import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorConflict,
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorForbiddenNotAuthorized
} from "@pagopa/ts-commons/lib/responses";

import { Context } from "@azure/functions";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";

import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { AssertionRef } from "../generated/definitions/internal/AssertionRef";
import { LcParams } from "../generated/definitions/internal/LcParams";

/**
 * Type of a GenerateLCParams handler
 */

type IGenerateLCParamsHandler = (
  context: Context,
  assertionRef: AssertionRef
) => Promise<
  | IResponseSuccessJson<LcParams>
  | IResponseErrorValidation
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorNotFound
  | IResponseErrorConflict
  | IResponseErrorInternal
>;
/**
 * Handles requests for getting a single message for a recipient.
 */
export const GenerateLCParamsHandler = (): IGenerateLCParamsHandler => async (
  context,
  assertionRef
): ReturnType<IGenerateLCParamsHandler> =>
  pipe(TE.left(ResponseErrorForbiddenNotAuthorized), TE.toUnion)();
/**
 * Wraps a GenerateLCParamsHandler handler inside an Express request handler.
 */
// eslint-disable-next-line max-params, prefer-arrow/prefer-arrow-functions
export function GenerateLCParams(): express.RequestHandler {
  const handler = GenerateLCParamsHandler();
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    RequiredParamMiddleware("assertion_ref", AssertionRef)
  );
  return wrapRequestHandler(middlewaresWrap((_, __) => handler(_, __)));
}
