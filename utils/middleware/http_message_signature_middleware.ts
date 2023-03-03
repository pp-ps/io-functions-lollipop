/* eslint-disable sort-keys */
// TODO: Move this file into io-functions-commons
import { IRequestMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  ResponseErrorFromValidationErrors,
  ResponseErrorInternal
} from "@pagopa/ts-commons/lib/responses";
import { constFalse, constTrue, identity, pipe } from "fp-ts/lib/function";
import * as t from "io-ts";
import * as E from "fp-ts/Either";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { getAppContext } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import * as TE from "fp-ts/TaskEither";
import * as httpSignature from "http-signature";
import * as express from "express";
import {
  JwkPublicKey,
  JwkPublicKeyFromToken
} from "@pagopa/ts-commons/lib/jwk";
import * as jwkToPem from "jwk-to-pem";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { JwkPubKeyToken } from "../../generated/definitions/internal/JwkPubKeyToken";
import * as crypto from "../crypto";

export const LollipopHeadersForSignature = t.intersection([
  t.type({
    ["x-pagopa-lollipop-public-key"]: JwkPubKeyToken
  }),
  t.partial({
    ["content-digest"]: NonEmptyString
  })
]);

export const isValidDigestHeader = (
  contentDigestHeader: string,
  body: Buffer
): boolean =>
  pipe(
    E.tryCatch(
      () => crypto.validateDigestHeader(contentDigestHeader, body),
      E.toError
    ),
    E.fold(constFalse, constTrue)
  );

export const validateHttpSignature = (
  request: express.Request,
  publicKey: string
): E.Either<Error, boolean> =>
  pipe(
    E.tryCatch(() => httpSignature.parseRequest(request), E.toError),
    E.chain(parsedHeaders =>
      E.tryCatch(
        () => httpSignature.verifySignature(parsedHeaders, publicKey),
        E.toError
      )
    )
  );

export const keyToPem = (key: JwkPublicKey): E.Either<Error, string> =>
  E.tryCatch(() => jwkToPem(key), E.toError);

export const HttpMessageSignatureMiddleware = (): IRequestMiddleware<
  "IResponseErrorValidation" | "IResponseErrorInternal",
  boolean
> => async (
  request
): ReturnType<
  IRequestMiddleware<
    "IResponseErrorValidation" | "IResponseErrorInternal",
    boolean
  >
> =>
  pipe(
    getAppContext(request),
    E.fromOption(() =>
      ResponseErrorInternal("Cannot get context from request")
    ),
    E.map(context => context.bindings.req.rawBody),
    E.bindTo("rawBody"),
    E.bindW("lollipopHeaders", () =>
      pipe(
        request.headers,
        LollipopHeadersForSignature.decode,
        E.mapLeft(
          ResponseErrorFromValidationErrors(LollipopHeadersForSignature)
        )
      )
    ),
    E.filterOrElseW(
      ({ rawBody, lollipopHeaders }) =>
        lollipopHeaders["content-digest"]
          ? isValidDigestHeader(lollipopHeaders["content-digest"], rawBody)
          : true,
      () => ResponseErrorInternal("The body do not match the content digest")
    ),
    E.chainW(({ lollipopHeaders }) =>
      pipe(
        lollipopHeaders["x-pagopa-lollipop-public-key"],
        JwkPublicKeyFromToken.decode,
        E.mapLeft(errors => new Error(readableReportSimplified(errors))),
        E.chain(keyToPem),
        E.chain(keyAsPom => validateHttpSignature(request, keyAsPom)),
        E.filterOrElse(
          identity,
          () =>
            new Error("The signature do not match with the request headers!")
        ),
        E.mapLeft(error =>
          ResponseErrorInternal(
            `Http Message Signature Validation failed: ${error.message}`
          )
        )
      )
    ),
    TE.fromEither
  )();
