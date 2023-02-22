import { flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import * as RA from "fp-ts/ReadonlyArray";
import { NewPubKeyPayload } from "../generated/definitions/internal/NewPubKeyPayload";
import { JwkPubKeyHashAlgorithmEnum } from "../generated/definitions/internal/JwkPubKeyHashAlgorithm";
import { calculateThumbprint } from "../utils/jose";
import { AssertionRef } from "../generated/definitions/external/AssertionRef";

export const MASTER_HASH_ALGO = JwkPubKeyHashAlgorithmEnum.sha512;

/**
 * Check if the input public key payload algo is the master one (current is sha512).
 * If the check succeed, returns an array containing the input payload, othrwise returns an array containig both the input payload and the input payload with algo set to master.
 *
 * @param publicKeyPayload a public key payload containig an hash algorithm and a public key
 * @returns
 */
export const pubKeyToAlgos = ({
  algo,
  pub_key
}: NewPubKeyPayload): ReadonlyArray<NewPubKeyPayload> =>
  pipe(
    algo === MASTER_HASH_ALGO ? [algo] : [algo, MASTER_HASH_ALGO],
    RA.map(targetAlgo => ({ algo: targetAlgo, pub_key }))
  );

/**
 * Calculate the assertion ref for the input payload. The assertion ref is a string in the format '<algo>-<thumbprint>'.
 *
 * @param publicKeyPayload a public key payload containig an hash algorithm and a public key
 * @returns an assertion ref
 */
export const calculateAssertionRef = ({
  algo,
  pub_key
}: NewPubKeyPayload): TE.TaskEither<Error, AssertionRef> =>
  pipe(
    pub_key,
    calculateThumbprint(algo),
    TE.map(thumbprint => `${String(algo)}-${thumbprint}`),
    TE.chainEitherKW(
      flow(
        AssertionRef.decode,
        E.mapLeft(e => new Error(readableReportSimplified(e)))
      )
    )
  );
