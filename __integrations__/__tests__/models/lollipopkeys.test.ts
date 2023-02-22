import { createContext } from "../../utils/cosmos_utils";
import {
  LolliPOPKeysModel,
  LOLLIPOPKEYS_MODEL_PK_FIELD
} from "../../../model/lollipop_keys";
import {
  aLolliPopPubKeys,
  aPendingLolliPopPubKeys
} from "../../../__mocks__/lollipopkeysMock";

import { PubKeyStatusEnum } from "../../../generated/definitions/internal/PubKeyStatus";

const context = createContext(LOLLIPOPKEYS_MODEL_PK_FIELD);

beforeEach(async () => await context.init());
afterEach(async () => await context.dispose());

describe("Create", () => {
  test("GIVEN a working model and a pending LolliPopPubKeys WHEN create method is called THEN the document should be in the database with ttl equal to 15m", async () => {
    const model = new LolliPOPKeysModel(context.container);
    await model.create(aPendingLolliPopPubKeys)();
    const retrievedDocument = await model.findLastVersionByModelId([
      aLolliPopPubKeys.assertionRef
    ])();

    expect(retrievedDocument).toEqual(
      expect.objectContaining({
        right: expect.objectContaining({
          _tag: "Some",
          value: expect.objectContaining({
            assertionRef: "sha256-p1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c",
            pubKey: "aValidPubKey",
            status: "PENDING",
            ttl: 900,
            version: 0
          })
        })
      })
    );
  });

  test("GIVEN a working model and a valid LolliPopPubKeys WHEN create method is called THEN the document should be in the database with ttl equal to 2y", async () => {
    const model = new LolliPOPKeysModel(context.container);
    await model.create(aLolliPopPubKeys)();
    const retrievedDocument = await model.findLastVersionByModelId([
      aLolliPopPubKeys.assertionRef
    ])();

    expect(retrievedDocument).toEqual(
      expect.objectContaining({
        right: expect.objectContaining({
          _tag: "Some",
          value: expect.objectContaining({
            assertionFileName:
              "RLDBSV36A78Y792X-sha256-p1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c",
            assertionRef: "sha256-p1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c",
            assertionType: "OIDC",
            fiscalCode: "RLDBSV36A78Y792X",
            pubKey: "aValidPubKey",
            status: "VALID",
            ttl: 63072000,
            version: 0
          })
        })
      })
    );
  });

  test("GIVEN a working model and 2 same documents WHEN create is called the second time THEN a COSMOS_CONFLICT_RESPONSE should be returned", async () => {
    const model = new LolliPOPKeysModel(context.container);
    await model.create({
      ...aLolliPopPubKeys,
      status: PubKeyStatusEnum.PENDING
    })();
    const r = await model.create({
      ...aLolliPopPubKeys,
      status: PubKeyStatusEnum.PENDING
    })();
    expect(r).toEqual(
      expect.objectContaining({
        _tag: "Left",
        left: { kind: "COSMOS_CONFLICT_RESPONSE" }
      })
    );
  });
});

describe("Upsert", () => {
  test("GIVEN a working model and a pending LolliPopPubKeys WHEN upsert method is called THEN the document should be in the database with ttl equal to 15m", async () => {
    const model = new LolliPOPKeysModel(context.container);
    await model.upsert(aPendingLolliPopPubKeys)();
    const retrievedDocument = await model.findLastVersionByModelId([
      aLolliPopPubKeys.assertionRef
    ])();

    expect(retrievedDocument).toEqual(
      expect.objectContaining({
        right: expect.objectContaining({
          _tag: "Some",
          value: expect.objectContaining({
            assertionRef: "sha256-p1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c",
            pubKey: "aValidPubKey",
            status: "PENDING",
            ttl: 900,
            version: 0
          })
        })
      })
    );
  });

  test("GIVEN a working model and a valid LolliPopPubKeys WHEN upsert method is called THEN the document should be in the database with ttl equal to 2y", async () => {
    const model = new LolliPOPKeysModel(context.container);
    await model.upsert(aLolliPopPubKeys)();
    const retrievedDocument = await model.findLastVersionByModelId([
      aLolliPopPubKeys.assertionRef
    ])();

    expect(retrievedDocument).toEqual(
      expect.objectContaining({
        right: expect.objectContaining({
          _tag: "Some",
          value: expect.objectContaining({
            assertionFileName:
              "RLDBSV36A78Y792X-sha256-p1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c",
            assertionRef: "sha256-p1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c",
            assertionType: "OIDC",
            fiscalCode: "RLDBSV36A78Y792X",
            pubKey: "aValidPubKey",
            status: "VALID",
            ttl: 63072000,
            version: 0
          })
        })
      })
    );
  });

  test("GIVEN a working model and a valid LolliPopKeys WHEN upsert method is called and a document with same assertionRef is inside database THEN it should create a new version with ttl to 2y", async () => {
    const model = new LolliPOPKeysModel(context.container);
    await model.create(aPendingLolliPopPubKeys)();
    await model.upsert(aLolliPopPubKeys)();
    const retrievedDocument = await model.findLastVersionByModelId([
      aLolliPopPubKeys.assertionRef
    ])();

    expect(retrievedDocument).toEqual(
      expect.objectContaining({
        right: expect.objectContaining({
          _tag: "Some",
          value: expect.objectContaining({
            assertionFileName:
              "RLDBSV36A78Y792X-sha256-p1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c",
            assertionRef: "sha256-p1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c",
            assertionType: "OIDC",
            fiscalCode: "RLDBSV36A78Y792X",
            pubKey: "aValidPubKey",
            status: "VALID",
            ttl: 63072000,
            version: 1
          })
        })
      })
    );
  });
});
