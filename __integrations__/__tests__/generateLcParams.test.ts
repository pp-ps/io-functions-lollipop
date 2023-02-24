/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable sort-keys */
import { exit } from "process";

import { Database } from "@azure/cosmos";

import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";

import { createCosmosDbAndCollections } from "../utils/fixtures";

import { getNodeFetch } from "../utils/fetch";
import { log } from "../utils/logger";

import { WAIT_MS, SHOW_LOGS, COSMOSDB_URI, COSMOSDB_NAME } from "../env";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import {
  LolliPOPKeysModel,
  LOLLIPOPKEYS_COLLECTION_NAME
} from "../../model/lollipop_keys";
import {
  aLolliPopPubKeys,
  anAssertionRef,
  aPendingLolliPopPubKeys
} from "../../__mocks__/lollipopkeysMock";
import * as date_fns from "date-fns";

const MAX_ATTEMPT = 50;

jest.setTimeout(WAIT_MS * MAX_ATTEMPT);

const baseUrl = "http://function:7071";
const fetch = getNodeFetch();

// ----------------
// Setup dbs
// ----------------

// eslint-disable-next-line functional/no-let
let database: Database;

// Wait some time
beforeAll(async () => {
  database = await pipe(
    createCosmosDbAndCollections(COSMOSDB_NAME),
    TE.getOrElse(e => {
      throw Error("Cannot create db");
    })
  )();

  await waitFunctionToSetup();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// -------------------------
// Tests
// -------------------------

const aGenerateLcParamsPayload = {
  operation_id: "an_operation_id" as NonEmptyString
};

const GENERATE_LC_PARAMS_BASE_PATH = "api/v1/pubkeys";
const fetchGenerateLcParams = (assertionRef: string, body: unknown) =>
  fetch(`${baseUrl}/${GENERATE_LC_PARAMS_BASE_PATH}/${assertionRef}/generate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

describe("GenerateLcParams", () => {
  test("GIVEN a new correctly initialized public key WHEN calling generateLcParams THEN return a success containing LcParams", async () => {
    const model = new LolliPOPKeysModel(
      database.container(LOLLIPOPKEYS_COLLECTION_NAME)
    );

    await model.upsert(aLolliPopPubKeys)();

    const result = await fetchGenerateLcParams(
      anAssertionRef,
      aGenerateLcParamsPayload
    );
    const content = await result.json();
    expect(content).toEqual(
      expect.objectContaining({
        pub_key: aLolliPopPubKeys.pubKey,
        status: aLolliPopPubKeys.status
      })
    );
  });

  test("GIVEN a pending public key WHEN calling generateLcParams THEN return Forbidden", async () => {
    const model = new LolliPOPKeysModel(
      database.container(LOLLIPOPKEYS_COLLECTION_NAME)
    );

    await model.create(aPendingLolliPopPubKeys)();

    const result = await fetchGenerateLcParams(
      anAssertionRef,
      aGenerateLcParamsPayload
    );
    expect(result.status).toEqual(403);
  });

  test("GIVEN an expired public key WHEN calling generateLcParams THEN return Forbidden", async () => {
    const model = new LolliPOPKeysModel(
      database.container(LOLLIPOPKEYS_COLLECTION_NAME)
    );

    await model.upsert({
      ...aLolliPopPubKeys,
      expiredAt: date_fns.addDays(new Date(), -1000)
    })();

    const result = await fetchGenerateLcParams(
      anAssertionRef,
      aGenerateLcParamsPayload
    );
    expect(result.status).toEqual(403);
  });

  test("GIVEN a malformed payload WHEN calling generateLcParams THEN return a bad request", async () => {
    const result = await fetchGenerateLcParams(anAssertionRef, {
      wrong: "wrong"
    });
    expect(result.status).toEqual(400);
  });
});

// -----------------------
// utils
// -----------------------

const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

const waitFunctionToSetup = async (): Promise<void> => {
  log("ENV: ", COSMOSDB_URI, WAIT_MS, SHOW_LOGS);
  // eslint-disable-next-line functional/no-let
  let i = 0;
  while (i < MAX_ATTEMPT) {
    log("Waiting the function to setup..");
    try {
      await fetch(baseUrl + "/info");
      break;
    } catch (e) {
      log("Waiting the function to setup...|" + JSON.stringify(e));
      await delay(WAIT_MS);
      i++;
    }
  }
  if (i >= MAX_ATTEMPT) {
    log("Function unable to setup in time");
    exit(1);
  }
};
