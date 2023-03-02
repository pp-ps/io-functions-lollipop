/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable sort-keys */
import { exit } from "process";

import { CosmosClient } from "@azure/cosmos";
import { createBlobService } from "azure-storage";

import * as TE from "fp-ts/TaskEither";
import * as jose from "jose";
import { pipe } from "fp-ts/lib/function";

import { getNodeFetch } from "../utils/fetch";
import { log } from "../utils/logger";
import { LolliPOPKeysModel } from "../../model/lollipop_keys";

import {
  WAIT_MS,
  SHOW_LOGS,
  COSMOSDB_URI,
  COSMOSDB_KEY,
  COSMOSDB_NAME,
  BEARER_AUTH_HEADER,
  QueueStorageConnection
} from "../env";
import {
  aFiscalCode,
  aValidSha256AssertionRef
} from "../../__mocks__/lollipopPubKey.mock";
import { ActivatePubKeyPayload } from "../../generated/definitions/internal/ActivatePubKeyPayload";
import { AssertionTypeEnum } from "../../generated/definitions/internal/AssertionType";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { fetchGetAssertion } from "../utils/client";
import { AssertionRef } from "../../generated/definitions/internal/AssertionRef";
import { JwkPublicKey } from "@pagopa/ts-commons/lib/jwk";
import { JwkPubKeyHashAlgorithmEnum } from "../../generated/definitions/internal/JwkPubKeyHashAlgorithm";
import { ProblemJson } from "@pagopa/ts-commons/lib/responses";
import {
  createCosmosDbAndCollections,
  LOLLIPOP_COSMOSDB_COLLECTION_NAME
} from "../utils/fixtures";
import { createBlobs } from "../utils/azure_storage";

const MAX_ATTEMPT = 50;

jest.setTimeout(WAIT_MS * MAX_ATTEMPT);

const customHeaders = {
  "x-user-groups": "ApiLollipopAssertionRead",
  "x-subscription-id": "anEnabledServiceId",
  "x-user-email": "unused@example.com",
  "x-user-id": "unused",
  "x-user-note": "unused",
  "x-functions-key": "unused",
  "x-forwarded-for": "0.0.0.0",
  "Ocp-Apim-Subscription-Key": "aSubscriptionKey"
};

const baseUrl = "http://function:7071";
const myFetch = (getNodeFetch(customHeaders) as unknown) as typeof fetch;

const LOLLIPOP_ASSERTION_STORAGE_CONTAINER_NAME = "assertions";

// ----------------
// Setup dbs
// ----------------

const blobService = createBlobService(QueueStorageConnection);

// @ts-ignore
const cosmosClient = new CosmosClient({
  endpoint: COSMOSDB_URI,
  key: COSMOSDB_KEY
});

// Wait some time
beforeAll(async () => {
  await pipe(
    createCosmosDbAndCollections(COSMOSDB_NAME),
    TE.getOrElse(() => {
      throw Error("Cannot create infra resources");
    })
  )();
  await pipe(
    createBlobs(blobService, [LOLLIPOP_ASSERTION_STORAGE_CONTAINER_NAME]),
    TE.getOrElse(() => {
      throw Error("Cannot create azure storage");
    })
  )();

  await waitFunctionToSetup();
});

beforeEach(() => {
  jest.clearAllMocks();
});

const cosmosInstance = cosmosClient.database(COSMOSDB_NAME);
const container = cosmosInstance.container(LOLLIPOP_COSMOSDB_COLLECTION_NAME);
const lolliPOPKeysModel = new LolliPOPKeysModel(container);

const expires = new Date();

const validActivatePubKeyPayload: ActivatePubKeyPayload = {
  assertion_type: AssertionTypeEnum.SAML,
  assertion: "aValidAssertion" as NonEmptyString,
  expired_at: expires,
  fiscal_code: aFiscalCode
};

// this method generates new JWK for use in the describe below
const generateJwkForTest = async (): Promise<JwkPublicKey> => {
  const keyPair = await jose.generateKeyPair("ES256");
  return (await jose.exportJWK(keyPair.publicKey)) as JwkPublicKey;
};

const generateAssertionRefForTest = async (
  jwk: JwkPublicKey,
  algo: JwkPubKeyHashAlgorithmEnum = JwkPubKeyHashAlgorithmEnum.sha256
): Promise<AssertionRef> => {
  const thumbprint = await jose.calculateJwkThumbprint(jwk, algo);
  return `${algo}-${thumbprint}` as AssertionRef;
};

// -------------------------
// Tests
// -------------------------

describe("getAssertion |> Validation Failures", () => {
  it("should fail when the required permissions are not met", async () => {
    const myFetchWithoutHeaders = (getNodeFetch() as unknown) as typeof fetch;

    const response = await fetchGetAssertion(
      aValidSha256AssertionRef,
      BEARER_AUTH_HEADER,
      "",
      baseUrl,
      myFetchWithoutHeaders
    );

    expect(response.status).toEqual(403);
    const problemJson = (await response.json()) as ProblemJson;
    expect(problemJson).toMatchObject({
      detail:
        "The request could not be associated to a user, missing userId or subscriptionId.",
      title: "Anonymous user",
      status: 403
    });
  });

  it("should fail when an invalid assertionRef is passed to the endpoint", async () => {
    const anInvalidAssertionRef = "anInvalidAssertionRef";

    const response = await fetchGetAssertion(
      anInvalidAssertionRef,
      BEARER_AUTH_HEADER,
      "",
      baseUrl,
      myFetch
    );

    expect(response.status).toEqual(400);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 400,
      title: "Invalid AssertionRef"
    });
  });

  it("should fail when an invalid jwt is passed to the endpoint", async () => {
    const anInvalidJwt = "anInvalidJwt";
    const randomJwk = await generateJwkForTest();
    const randomAssertionRef = await generateAssertionRefForTest(randomJwk);

    const response = await fetchGetAssertion(
      randomAssertionRef,
      BEARER_AUTH_HEADER,
      anInvalidJwt,
      baseUrl,
      myFetch
    );

    expect(response.status).toEqual(403);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 403,
      detail: `Invalid or missing JWT in header ${BEARER_AUTH_HEADER}`,
      title: "You are not allowed here"
    });
  });

  // it("should fail when the assertionRef in the endpoint does not match the one in the jwt", async () => {
  //   const anInvalidJwt = "anInvalidJwt";
  //   const randomJwk = await generateJwkForTest();
  //   const randomAssertionRef = await generateAssertionRefForTest(randomJwk);

  //   const response = await fetchGetAssertion(
  //     randomAssertionRef,
  //     BEARER_AUTH_HEADER,
  //     anInvalidJwt,
  //     baseUrl,
  //     myFetch
  //   );

  //   expect(response.status).toEqual(403);
  //   const body = await response.json();
  //   expect(body).toMatchObject({
  //     status: 403,
  //     title: `Invalid or missing JWT in header ${BEARER_AUTH_HEADER}`
  //   });
  // });
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
      await myFetch(baseUrl + "/info");
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
