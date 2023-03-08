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
import * as express from "express";
import {
  JwkPublicKey,
  JwkPublicKeyFromToken
} from "@pagopa/ts-commons/lib/jwk";
import * as jwkToPem from "jwk-to-pem";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { verifySignatureHeader } from "@mattrglobal/http-signatures";
import * as crypto from "../crypto";
import { JwkPubKeyToken } from "../../generated/definitions/internal/JwkPubKeyToken";

import { AssertionRef } from "../../generated/definitions/internal/AssertionRef";

export const LollipopHeadersForSignature = t.intersection([
  t.type({
    ["x-pagopa-lollipop-public-key"]: JwkPubKeyToken,
    ["x-pagopa-lollipop-assertion-ref"]: AssertionRef
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
  assertionRef: AssertionRef,
  publicKey: JwkPublicKey
): TE.TaskEither<Error, boolean> =>
  pipe(
    {
      httpHeaders: request.headers,
      url: request.url,
      method: request.method,
      verifier: {
        keyMap: {
          [assertionRef]: {
            key: publicKey
          }
        }
      }
    },
    TE.of,
    TE.chain(params =>
      TE.tryCatch(async () => await verifySignatureHeader(params), E.toError)
    ),
    TE.map(res =>
      res.map(r =>
        r.verified
          ? TE.of(true)
          : TE.left(new Error("HTTP Request Signature failed"))
      )
    ),
    TE.chainW(res =>
      res.unwrapOr(
        TE.left(new Error("An error occurred during signature check"))
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
    TE.fromEither,
    TE.chainW(({ lollipopHeaders }) =>
      pipe(
        lollipopHeaders["x-pagopa-lollipop-public-key"],
        JwkPublicKeyFromToken.decode,
        E.mapLeft(errors => new Error(readableReportSimplified(errors))),
        TE.fromEither,
        TE.chain(key =>
          validateHttpSignature(
            request,
            lollipopHeaders["x-pagopa-lollipop-assertion-ref"],
            key
          )
        ),
        TE.filterOrElse(
          identity,
          () =>
            new Error("The signature do not match with the request headers!")
        ),
        TE.mapLeft(error =>
          ResponseErrorInternal(
            `Http Message Signature Validation failed: ${error.message}`
          )
        )
      )
    )
  )();
