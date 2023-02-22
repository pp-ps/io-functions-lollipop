import { Container } from "@azure/cosmos";
import { AssertionRef } from "@pagopa/io-functions-commons/dist/generated/definitions/lollipop/AssertionRef";
import { AssertionTypeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/lollipop/AssertionType";
import { CosmosResource } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  AssertionFileName,
  PendingLolliPopPubKeys,
  LolliPopPubKeys,
  RetrievedLolliPopPubKeys,
  TTL_VALUE_AFTER_UPDATE
} from "../model/lollipop_keys";
import { PubKeyStatusEnum } from "../generated/definitions/internal/PubKeyStatus";

export const aFiscalCode = "RLDBSV36A78Y792X" as FiscalCode;
export const anAssertionRef = "sha256-p1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c" as AssertionRef;
export const anAssertionFileName = `${aFiscalCode}-${anAssertionRef}` as AssertionFileName;
export const aPubKey = "aValidPubKey" as NonEmptyString;

export const aCosmosResourceMetadata: Omit<CosmosResource, "id"> = {
  _etag: "_etag",
  _rid: "_rid",
  _self: "_self",
  _ts: 1
};

export const aPendingLolliPopPubKeys: PendingLolliPopPubKeys = {
  assertionRef: anAssertionRef,
  pubKey: aPubKey,
  status: PubKeyStatusEnum.PENDING
};

export const aLolliPopPubKeys: LolliPopPubKeys = {
  assertionFileName: anAssertionFileName,
  assertionRef: anAssertionRef,
  assertionType: AssertionTypeEnum.OIDC,
  expiredAt: new Date(),
  fiscalCode: aFiscalCode,
  pubKey: aPubKey,
  status: PubKeyStatusEnum.VALID
};

export const aRetrievedLolliPopPubKeys: RetrievedLolliPopPubKeys = {
  id: `${aLolliPopPubKeys.assertionRef}-${"0".repeat(16)}` as NonEmptyString,
  ...aCosmosResourceMetadata,
  ...aLolliPopPubKeys,
  ttl: TTL_VALUE_AFTER_UPDATE, // 2y
  version: 0 as NonNegativeInteger
};

export const mockCreateItem = jest.fn();
export const mockUpsert = jest.fn();
export const mockFetchAll = jest.fn().mockImplementationOnce(async () => ({
  resources: []
}));

export const containerMock = ({
  items: {
    create: mockCreateItem,
    query: jest.fn(() => ({
      fetchAll: mockFetchAll
    })),
    upsert: mockUpsert
  }
} as unknown) as Container;
