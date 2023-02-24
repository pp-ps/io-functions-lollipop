import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import * as B from "fp-ts/boolean";
import * as O from "fp-ts/Option";
import { flow, pipe } from "fp-ts/lib/function";
import { JwkPublicKey } from "@pagopa/ts-commons/lib/jwk";
import * as jose from "jose";
import * as t from "io-ts";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  JwkPubKeyHashAlgorithm,
  JwkPubKeyHashAlgorithmEnum
} from "../generated/definitions/internal/JwkPubKeyHashAlgorithm";
import { AssertionRefSha512 } from "../generated/definitions/internal/AssertionRefSha512";
import { AssertionRef } from "../generated/definitions/internal/AssertionRef";
import { AssertionRefSha384 } from "../generated/definitions/internal/AssertionRefSha384";
import { AssertionRefSha256 } from "../generated/definitions/internal/AssertionRefSha256";
import { assertNever } from "./errors";

export const AssertionRefByType = t.intersection([
  t.type({
    master: AssertionRef
  }),
  t.partial({
    used: AssertionRef
  })
]);

export type AssertionRefByType = t.TypeOf<typeof AssertionRefByType>;

const getMasterAssertionRefType = (
  masterAlgo: JwkPubKeyHashAlgorithm
): typeof AssertionRef.types[number] => {
  switch (masterAlgo) {
    case JwkPubKeyHashAlgorithmEnum.sha512:
      return AssertionRefSha512;
    case JwkPubKeyHashAlgorithmEnum.sha384:
      return AssertionRefSha384;
    case JwkPubKeyHashAlgorithmEnum.sha256:
      return AssertionRefSha256;
    default:
      return assertNever(masterAlgo);
  }
};

export const calculateAssertionRef = (algo: JwkPubKeyHashAlgorithm) => (
  jwkPublicKey: JwkPublicKey
): TE.TaskEither<Error, AssertionRef> =>
  pipe(
    TE.tryCatch(
      () => jose.calculateJwkThumbprint(jwkPublicKey, algo),
      flow(E.toError, err =>
        Error(`Cannot calculate master key jwk's thumbprint|${err.message}`)
      )
    ),
    TE.chainEitherK(
      flow(
        thumbprint => `${algo}-${thumbprint}`,
        AssertionRef.decode,
        E.mapLeft(() => Error("Cannot decode master AssertionRef"))
      )
    )
  );

export const algoToAssertionRefSet = new Set([
  { algo: JwkPubKeyHashAlgorithmEnum.sha256, type: AssertionRefSha256 },
  { algo: JwkPubKeyHashAlgorithmEnum.sha384, type: AssertionRefSha384 },
  { algo: JwkPubKeyHashAlgorithmEnum.sha512, type: AssertionRefSha512 }
]);

export const getAlgoFromAssertionRef = (
  assertionRef: AssertionRef
): JwkPubKeyHashAlgorithm =>
  pipe(
    Array.from(algoToAssertionRefSet),
    ar => ar.find(entry => entry.type.is(assertionRef)),
    O.fromNullable,
    O.map(pubKeyHashAlgo => pubKeyHashAlgo.algo),
    O.getOrElseW(() => void 0 as never)
  );

export const encodeJwkBase64 = (jwk: JwkPublicKey): NonEmptyString =>
  pipe(
    jwk,
    JSON.stringify,
    stringifiedJwk => jose.base64url.encode(stringifiedJwk) as NonEmptyString
  );

/**
 * Return all assertionsRef related to a given used pubKey
 */
export const getAllAssertionsRef = (
  masterAlgo: JwkPubKeyHashAlgorithm,
  usedAlgo: JwkPubKeyHashAlgorithm,
  jwkPubKey: JwkPublicKey
): TE.TaskEither<Error, AssertionRefByType> =>
  pipe(
    jwkPubKey,
    calculateAssertionRef(usedAlgo),
    TE.chain(usedAssertionRef =>
      pipe(
        usedAssertionRef,
        getMasterAssertionRefType(masterAlgo).is,
        B.fold(
          () =>
            pipe(
              jwkPubKey,
              calculateAssertionRef(masterAlgo),
              TE.map(validMasterLollipopPubKeyAssertionRef => ({
                master: validMasterLollipopPubKeyAssertionRef,
                used: usedAssertionRef
              }))
            ),
          () => TE.of({ master: usedAssertionRef })
        )
      )
    )
  );
