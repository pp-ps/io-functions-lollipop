import { aJwkPubKey, aNotValidRsaJwkPublicKey } from "../../__mocks__/jwkMock";
import { calculateThumbprint, encodeBase64 } from "../jose";
import * as E from "fp-ts/Either";
import { JwkPublicKey } from "@pagopa/ts-commons/lib/jwk";

describe("calculateThumbprint", () => {
  test("GIVEN a valid jwk WHEN calculateThumbprint THEN return the thumbprint of the jwk", async () => {
    const jwk = aJwkPubKey;
    const result = await calculateThumbprint(jwk)();
    expect(E.isRight(result)).toBeTruthy();
  });
});

describe("encodeBase64", () => {
  test("GIVEN a valid jwk WHEN encodeBase64 THEN return the json of the jwk encoded in base64", async () => {
    const jwk = aJwkPubKey;
    const result = encodeBase64(jwk);
    const decoded = Buffer.from(result, "base64").toString("utf-8");
    expect(JwkPublicKey.decode(JSON.parse(decoded))).toEqual(
      expect.objectContaining({ right: jwk })
    );
  });
});
