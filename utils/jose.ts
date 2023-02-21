import * as jose from "jose";
import * as TE from "fp-ts/TaskEither";
import { JwkPublicKey } from "@pagopa/ts-commons/lib/jwk";
import { flow } from "fp-ts/lib/function";

export const calculateThumbprint = (
  jwkPubKey: jose.JWK
): TE.TaskEither<Error, string> =>
  TE.tryCatch(
    () => jose.calculateJwkThumbprint(jwkPubKey),
    err => new Error(`Can not calculate JwkThumbprint | ${err}`)
  );

export const encodeBase64: (jwkPubKey: JwkPublicKey) => string = flow(
  JSON.stringify,
  jose.base64url.encode
);
