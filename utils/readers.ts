import { BlobService } from "azure-storage";
import * as RTE from "fp-ts/ReaderTaskEither";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { getBlobAsTextWithError } from "@pagopa/io-functions-commons/dist/src/utils/azure_storage";

import { AssertionRef } from "../generated/definitions/internal/AssertionRef";
import {
  LolliPOPKeysModel,
  RetrievedLolliPopPubKeys
} from "../model/lollipop_keys";
import { AssertionFileName } from "../generated/definitions/internal/AssertionFileName";
import {
  cosmosErrorsToString,
  toInternalError,
  toNotFoundError,
  DomainError,
  ErrorKind
} from "./errors";

export type PopDocumentReader = RTE.ReaderTaskEither<
  AssertionRef,
  DomainError,
  RetrievedLolliPopPubKeys
>;

export type AssertionReader = RTE.ReaderTaskEither<
  AssertionFileName,
  DomainError,
  NonEmptyString
>;

// -------------------------
// Readers implementations
// -------------------------

/**
 * Return a PopDocumentReader that retrieves the value from Cosmos
 *
 * @param lollipopKeysModel the LolliPOPKeysModel model to use
 * @returns The PopDocumentReader
 */
export const getPopDocumentReader = (
  lollipopKeysModel: LolliPOPKeysModel
): PopDocumentReader => (
  assertionRef: AssertionRef
): ReturnType<PopDocumentReader> =>
  pipe(
    lollipopKeysModel.findLastVersionByModelId([assertionRef]),
    TE.mapLeft(error => ({
      detail: cosmosErrorsToString(error),
      kind: ErrorKind.Internal as const
    })),
    TE.chainW(TE.fromOption(() => ({ kind: ErrorKind.NotFound as const })))
  );

/**
 * Return a AssertionReader that retrieves the value from a Blob Service
 *
 * @param blobService the azure blobService
 * @param assertionContainerName the name of the container where the blob is stored
 * @returns The AssertionReader
 */
export const getAssertionReader = (
  blobService: BlobService,
  assertionContainerName: NonEmptyString
): AssertionReader => (
  assertionFileName: AssertionFileName
): ReturnType<AssertionReader> =>
  pipe(
    assertionFileName,
    getBlobAsTextWithError(blobService, assertionContainerName),
    TE.mapLeft(error =>
      toInternalError(
        `Unable to retrieve assertion ${assertionFileName} from blob storage: ${error.message}`
      )
    ),
    TE.chainW(TE.fromOption(() => toNotFoundError())),
    TE.filterOrElseW(NonEmptyString.is, () =>
      toInternalError(`Assertion ${assertionFileName} is empty`)
    )
  );
