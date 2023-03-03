import * as express from "express";
import { withRequestMiddlewares } from "@pagopa/ts-commons/lib/request_middleware";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { RequiredBodyPayloadMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_body_payload";
import { wrapRequestHandler } from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorInternal
} from "@pagopa/ts-commons/lib/responses";
import { SignedMessagePayload } from "../generated/definitions/lollipop-first-consumer/SignedMessagePayload";
import { SignedMessageResponse } from "../generated/definitions/lollipop-first-consumer/SignedMessageResponse";
import { createClient as externalClient } from "../generated/definitions/external/client";
import {
  LollipopHeaders,
  RequiredHeadersMiddleware
} from "../utils/middleware/required_header";
import { HttpMessageSignatureMiddleware } from "../utils/middleware/http_message_signature_middleware";

type ISignedMessageHandler = (
  lollipopHeaders: LollipopHeaders,
  inputPubkeys: SignedMessagePayload
) => Promise<
  | IResponseSuccessJson<SignedMessageResponse>
  | IResponseErrorValidation
  | IResponseErrorInternal
>;

export const signedMessageHandler = (
  _assertionClient: ReturnType<typeof externalClient>
): ISignedMessageHandler => async (
  _lollipopHeaders: LollipopHeaders,
  _inputSignedMessage
): ReturnType<ISignedMessageHandler> =>
  ResponseErrorInternal("Not Implemented");

export const getSignedMessageHandler = (
  assertionClient: ReturnType<typeof externalClient>
): express.RequestHandler => {
  const handler = signedMessageHandler(assertionClient);
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    RequiredHeadersMiddleware(LollipopHeaders),
    RequiredBodyPayloadMiddleware(SignedMessagePayload),
    HttpMessageSignatureMiddleware()
  );
  return wrapRequestHandler(
    middlewaresWrap((_, lollipopHeaders, inputSignedMessage, __) =>
      handler(lollipopHeaders, inputSignedMessage)
    )
  );
};
