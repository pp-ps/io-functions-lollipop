import * as t from "io-ts";
import * as TE from "fp-ts/lib/TaskEither";
import * as O from "fp-ts/lib/Option";

import {
  CosmosdbModelVersionedTTL,
  RetrievedVersionedModelTTL
} from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model_versioned_ttl";
import {
  FiscalCode,
  NonEmptyString,
  PatternString
} from "@pagopa/ts-commons/lib/strings";
import { Container, RequestOptions } from "@azure/cosmos";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";

import { AssertionRef } from "@pagopa/io-functions-commons/dist/generated/definitions/lollipop/AssertionRef";
import { AssertionType } from "@pagopa/io-functions-commons/dist/generated/definitions/lollipop/AssertionType";
import { Timestamp } from "@pagopa/io-functions-commons/dist/generated/definitions/Timestamp";
import {
  CosmosErrors,
  toCosmosErrorResponse
} from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { flow, pipe } from "fp-ts/lib/function";
import { PubKeyStatusEnum } from "../generated/definitions/internal/PubKeyStatus";

const LOLLIPOPKEYS_MODEL_PK_FIELD = "assertionRef" as const;
const LOLLIPOPKEYS_MODEL_ID_FIELD = LOLLIPOPKEYS_MODEL_PK_FIELD;

export const Ttl = t.interface({
  ttl: NonNegativeInteger // do we need this to be -1 in some cases?
});
export type Ttl = t.TypeOf<typeof Ttl>;

// The time for which we want to reserve a key during login process (in seconds)
export const TTL_VALUE_FOR_RESERVATION = (60 * 15) as NonNegativeInteger; // 15m
// The time for which we want to keep the popDocument
export const TTL_VALUE_AFTER_UPDATE = (60 *
  60 *
  24 *
  365 *
  2) as NonNegativeInteger; // 2y

// fiscal code - AssertionRefsha256 | AssertionRefSha384 | AssertionRefSha512
export const AssertionFileName = PatternString(
  "^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]-(sha256-[A-Za-z0-9-_=]{1,44}|sha384-[A-Za-z0-9-_=]{1,66}|sha512-[A-Za-z0-9-_=]{1,88})$"
);
export type AssertionFileName = t.TypeOf<typeof AssertionFileName>;

export const PendingPopDocument = t.interface({
  assertionRef: AssertionRef,
  pubKey: NonEmptyString,
  status: t.literal(PubKeyStatusEnum.PENDING)
});
export type PendingPopDocument = t.TypeOf<typeof PendingPopDocument>;

export const NotPendingPopDocument = t.interface({
  assertionFileName: AssertionFileName,
  assertionRef: AssertionRef,
  assertionType: AssertionType,
  expiredAt: Timestamp,
  fiscalCode: FiscalCode,
  pubKey: NonEmptyString,
  status: t.union([
    t.literal(PubKeyStatusEnum.VALID),
    t.literal(PubKeyStatusEnum.REVOKED)
  ])
});
export type NotPendingPopDocument = t.TypeOf<typeof NotPendingPopDocument>;

export const PopDocumentBase = t.interface({
  assertionRef: AssertionRef,
  pubKey: NonEmptyString
});
export type PopDocumentBase = t.TypeOf<typeof PopDocumentBase>;

// T type
export const LolliPopPubKeys = t.union([
  NotPendingPopDocument,
  PendingPopDocument
]);
export type LolliPopPubKeys = t.TypeOf<typeof LolliPopPubKeys>;

// TN type
export const NewLolliPopPubKeys = t.intersection([LolliPopPubKeys, Ttl]);
export type NewLolliPopPubKeys = t.TypeOf<typeof NewLolliPopPubKeys>;

// TR type
export const RetrievedLolliPopPubKeys = t.intersection([
  LolliPopPubKeys,
  RetrievedVersionedModelTTL
]);
export type RetrievedLolliPopPubKeys = t.TypeOf<
  typeof RetrievedLolliPopPubKeys
>;

export class LolliPOPKeysModel extends CosmosdbModelVersionedTTL<
  LolliPopPubKeys,
  NewLolliPopPubKeys,
  RetrievedLolliPopPubKeys,
  typeof LOLLIPOPKEYS_MODEL_ID_FIELD
> {
  constructor(container: Container) {
    super(
      container,
      NewLolliPopPubKeys,
      RetrievedLolliPopPubKeys,
      LOLLIPOPKEYS_MODEL_ID_FIELD
    );
  }

  /*
   * Reserve the key by creating a new document with version 0 with the ttl setted for the time needed,
   * */
  public create(
    popDocument: LolliPopPubKeys,
    option?: RequestOptions
  ): TE.TaskEither<CosmosErrors, RetrievedLolliPopPubKeys> {
    return pipe(
      this.getTtlValue(popDocument),
      // super.create never returns 409 error but a generic CosmosErrorResponse with io-functions-commons v26.8.1
      TE.chain(ttl => super.create({ ...popDocument, ttl }, option))
    );
  }

  /*
   * Update the last version of the document setting the new properties and the ttl at 2 years
   * */
  public upsert(
    popDocument: LolliPopPubKeys,
    option?: RequestOptions
  ): TE.TaskEither<CosmosErrors, RetrievedLolliPopPubKeys> {
    return pipe(
      this.getTtlValue(popDocument),
      TE.chain(ttl => super.upsert({ ...popDocument, ttl }, option))
    );
  }

  /**
   * This method is disabled to avoid wrong use cases. Use upsert instead.
   *
   * @deprecated
   * */
  public update(
    _: RetrievedLolliPopPubKeys
  ): TE.TaskEither<CosmosErrors, never> {
    return TE.left(
      toCosmosErrorResponse(new Error("Cannot update a lollipop document"))
    );
  }

  /**
   * This method is disabled to avoid wrong use cases.
   *
   * @deprecated Use updateKeys instead.
   * */
  public updateTTLForAllVersions(): TE.TaskEither<CosmosErrors, never> {
    return TE.left(
      toCosmosErrorResponse(
        new Error("Cannot update tll for old versions in a lollipop document")
      )
    );
  }

  private getTtlValue(
    popDocument: LolliPopPubKeys
  ): TE.TaskEither<CosmosErrors, NonNegativeInteger> {
    return pipe(
      super.findLastVersionByModelId([popDocument.assertionRef]),
      TE.map(
        flow(
          // if the last version was PENDING the new ttl is setted to TTL_VALUE_AFTER_UPDATE
          // if the last version ttl is missing then the new ttl is setted to TTL_VALUE_AFTER_UPDATE to avoid setting the ttl to a negative value
          O.map(lastPop =>
            lastPop.status === PubKeyStatusEnum.PENDING ||
            (lastPop.ttl ?? 0) < 1
              ? TTL_VALUE_AFTER_UPDATE
              : // eslint-disable-next-line @typescript-eslint/restrict-plus-operands, no-underscore-dangle
                ((lastPop._ts +
                  (lastPop.ttl ?? 0) -
                  Math.floor(
                    new Date().getTime() / 1000
                  )) as NonNegativeInteger)
          ),
          O.getOrElseW(() =>
            popDocument.status === PubKeyStatusEnum.PENDING
              ? TTL_VALUE_FOR_RESERVATION
              : TTL_VALUE_AFTER_UPDATE
          )
        )
      )
    );
  }
}
