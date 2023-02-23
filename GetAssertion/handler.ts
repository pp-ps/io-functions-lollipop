import * as express from "express";

import { RequiredParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_param";

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
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import {
  AzureApiAuthMiddleware,
  IAzureApiAuthorization,
  UserGroup
} from "@pagopa/io-functions-commons/dist/src/utils/middlewares/azure_api_auth";

import { Context } from "@azure/functions";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";

import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { BlobService } from "azure-storage";
import { AssertionRef } from "../generated/definitions/internal/AssertionRef";
import { LolliPOPKeysModel } from "../model/lollipop_keys";
import { LCUserInfo } from "../generated/definitions/external/LCUserInfo";

/**
 * Type of a GetAssertion handler
 */

type IGetAssertionHandler = (
  context: Context,
  auth: IAzureApiAuthorization,
  assertionRef: AssertionRef
) => Promise<
  | IResponseSuccessJson<LCUserInfo>
  | IResponseErrorValidation
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorNotFound
  | IResponseErrorInternal
  // TODO Add 410 Response type
>;
/**
 * Handles requests for generating Lollipop Consumer required params.
 */
export const GetAssertionHandler = (
  _: LolliPOPKeysModel,
  __: BlobService
): IGetAssertionHandler => async (
  _ctx,
  _apiAuth,
  _assertionRef
): ReturnType<IGetAssertionHandler> =>
  pipe(
    ResponseSuccessJson({
      response_xml: "<xml>Test</xml>" as NonEmptyString
    }),
    TE.right,
    TE.toUnion
  )();

/**
 * Wraps a GetAssertion handler inside an Express request handler.
 */
// eslint-disable-next-line max-params, prefer-arrow/prefer-arrow-functions
export function GetAssertion(
  lollipopKeysModel: LolliPOPKeysModel,
  assertionBlobService: BlobService
): express.RequestHandler {
  const handler = GetAssertionHandler(lollipopKeysModel, assertionBlobService);
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    AzureApiAuthMiddleware(new Set([UserGroup.ApiLollipopAssertionRead])),
    RequiredParamMiddleware("assertion_ref", AssertionRef)
    // TODO add Jwt middleware
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
