import { flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import * as RA from "fp-ts/ReadonlyArray";
import { NewPubKeyPayload } from "../generated/definitions/internal/NewPubKeyPayload";
import { JwkPubKeyHashAlgorithmEnum } from "../generated/definitions/internal/JwkPubKeyHashAlgorithm";
import { calculateThumbprint } from "../utils/jose";
import { AssertionRef } from "../generated/definitions/external/AssertionRef";

const masterHashAlgo = JwkPubKeyHashAlgorithmEnum.sha512;

export const pubKeyToAlgos = ({
  algo,
  pub_key
}: NewPubKeyPayload): ReadonlyArray<NewPubKeyPayload> =>
  pipe(
    algo === masterHashAlgo ? [algo] : [algo, masterHashAlgo],
    RA.map(targetAlgo => ({ algo: targetAlgo, pub_key }))
  );

export const calculateAssertionRef = ({
  algo,
  pub_key
}: NewPubKeyPayload): TE.TaskEither<Error, AssertionRef> =>
  pipe(
    pub_key,
    calculateThumbprint,
    TE.map(thumbprint => `${String(algo)}-${thumbprint}`),
    TE.chainEitherKW(
      flow(
        AssertionRef.decode,
        E.mapLeft(e => new Error(readableReportSimplified(e)))
      )
    )
  );
