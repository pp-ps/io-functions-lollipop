import * as TE from "fp-ts/TaskEither";

import { AssertionRef } from "../generated/definitions/internal/AssertionRef";

import { AssertionFileName } from "../model/lollipop_keys";
import { AssertionReader, PopDocumentReader } from "../utils/readers";

import { aRetrievedPendingLollipopPubKeySha256 } from "./lollipopPubKey.mock";

export const anAssertionContent = "an Assertion";

export const popDocumentReaderMock = jest.fn(
  (assertionRef: AssertionRef) =>
    TE.of({
      ...aRetrievedPendingLollipopPubKeySha256,
      assertionRef: assertionRef,
      id: `${assertionRef}-000000`,
      version: 0
    }) as ReturnType<PopDocumentReader>
);

export const assertionReaderMock = jest.fn(
  (_: AssertionFileName) =>
    TE.of(anAssertionContent) as ReturnType<AssertionReader>
);
