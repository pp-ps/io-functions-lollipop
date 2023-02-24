/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable sort-keys */
import { exit } from "process";

import { Database } from "@azure/cosmos";

import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";

import { createCosmosDbAndCollections } from "../utils/fixtures";

import { getNodeFetch } from "../utils/fetch";
import { log } from "../utils/logger";

import {
  WAIT_MS,
  SHOW_LOGS,
  COSMOSDB_URI,
  COSMOSDB_NAME,
  LOLLIPOP_ASSERTION_STORAGE_CONNECTION_STRING
} from "../env";
import { createQueues } from "../utils/azure_storage";
import { QueueServiceClient } from "@azure/storage-queue";

const MAX_ATTEMPT = 50;

jest.setTimeout(WAIT_MS * MAX_ATTEMPT);

const baseUrl = "http://function:7071";
const fetch = getNodeFetch();

// ----------------
// Setup dbs
// ----------------

const queueClient = QueueServiceClient.fromConnectionString(
  LOLLIPOP_ASSERTION_STORAGE_CONNECTION_STRING
);

// eslint-disable-next-line functional/no-let
let database: Database;

// Wait some time
beforeAll(async () => {
  database = await pipe(
    createCosmosDbAndCollections(COSMOSDB_NAME),
    TE.getOrElse(e => {
      throw Error("Cannot create infra resources");
    })
  )();

  await pipe(
    TE.fromTask(createQueues(queueClient, ["revoke-queue"])),
    TE.getOrElse(() => {
      throw Error("Cannot create queues");
    })
  )();
  // await pipe(
  //   createBlobs(blobService, [MESSAGE_CONTAINER_NAME]),
  //   TE.getOrElse(() => {
  //     throw Error("Cannot create azure storage");
  //   })
  // )();

  await waitFunctionToSetup();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// -------------------------
// Tests
// -------------------------

describe("activatePubKey |> Success Results", () => {
  it("dummy", () => {
    expect(true).toBe(true);
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
      log("Waiting the function to setup..");
      await delay(WAIT_MS);
      i++;
    }
  }
  if (i >= MAX_ATTEMPT) {
    log("Function unable to setup in time");
    exit(1);
  }
};
