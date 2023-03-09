import * as E from "fp-ts/Either";

import { Client } from "../../generated/definitions/external/client";
import {
  aValidJwk,
  aValidSha256AssertionRef
} from "../../__mocks__/lollipopPubKey.mock";

import { signedMessageHandler } from "../handler";
import { aSAMLResponse } from "../../__mocks__/assertion.mock";
import {
  aValidPayload,
  firstLcAssertionClientConfig,
  validLollipopHeaders
} from "../../__mocks__/lollipopSignature.mock";

// -----------------
// mocks
// -----------------

const getAssertionMock = jest.fn(async () =>
  E.right({
    status: 200,
    value: { response_xml: aSAMLResponse }
  })
);
const assertionClientMock = ({
  getAssertion: getAssertionMock
} as unknown) as Client<"ApiKeyAuth">;

// -----------------
// tests
// -----------------

describe("FirstLollipopConsumerSignedMessage", () => {
  test(`GIVEN a valid LolliPoP request,
        WHEN all checks passed
        THEN the assertion ref is returned`, async () => {
    const handler = signedMessageHandler(
      assertionClientMock,
      firstLcAssertionClientConfig
    );

    const res = await handler(aValidJwk, validLollipopHeaders, aValidPayload);

    expect(res).toMatchObject({
      kind: "IResponseSuccessJson",
      value: { response: aValidSha256AssertionRef }
    });
  });
});
