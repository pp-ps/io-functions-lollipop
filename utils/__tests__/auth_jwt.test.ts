import * as jwt from "jsonwebtoken";

import * as E from "fp-ts/Either";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { Second } from "@pagopa/ts-commons/lib/units";

import {
  AuthJWT,
  DecodedAuthJWT,
  getGenerateAuthJWT,
  getValidateAuthJWT,
  standardJWTTTL
} from "../auth_jwt";

import { IConfig } from "../config";

import { aPrimaryKey, aSecondaryKey } from "../../__mocks__/keys";
import { getGenerateJWT } from "../jwt_with_key_rotation";

const issuer = "test-issuer" as NonEmptyString;

const aPayload = {
  assertionRef: "sha256-p1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c",
  operationId: "anOperationId"
} as AuthJWT;

const aConfigWithPrimaryKey = {
  ISSUER: issuer,
  PRIMARY_PRIVATE_KEY: aPrimaryKey.privateKey,
  PRIMARY_PUBLIC_KEY: aPrimaryKey.publicKey
} as IConfig;

describe("getGenerateJWT", () => {
  it("should generate a valid AuthJWT", async () => {
    const generateJWT = getGenerateAuthJWT(aConfigWithPrimaryKey);

    const res = await generateJWT(aPayload)();

    expect(res).toMatchObject(
      E.right(expect.stringMatching(`[A-Za-z0-9-_]{1,520}`))
    );
  });
});

describe("getValidateJWT - Success", () => {
  it("should succeed validating a valid JWT", async () => {
    // Setup
    const generateJWT = getGenerateAuthJWT(aConfigWithPrimaryKey);
    const token = await generateJWT(aPayload)();

    if (E.isRight(token)) {
      // Test
      const result = await getValidateAuthJWT(aConfigWithPrimaryKey)(
        token.right
      )();
      checkDecodedToken(result);
    } else {
      fail("Invalid token");
    }
  });
});

describe("getValidateJWT - Failures", () => {
  it("should  fail validating a JWT with invalid payload", async () => {
    // Setup
    const generateJWT = getGenerateJWT(
      aConfigWithPrimaryKey.ISSUER,
      aConfigWithPrimaryKey.PRIMARY_PRIVATE_KEY
    );
    const token = await generateJWT({ a: "a", b: 1 }, standardJWTTTL)();

    if (E.isRight(token)) {
      // Test
      const result = await getValidateAuthJWT(aConfigWithPrimaryKey)(
        token.right
      )();

      expect(result).toMatchObject(
        E.left(E.toError("Invalid AuthJWT payload"))
      );
    } else {
      fail("Invalid token");
    }
  });
});

// -------------------
// private methods
// -------------------

const checkDecodedToken = async (result: E.Either<Error, DecodedAuthJWT>) => {
  expect(result).toMatchObject(
    E.right(
      expect.objectContaining({
        ...aPayload,
        iss: issuer,
        iat: expect.any(Number),
        exp: expect.any(Number),
        jti: expect.any(String)
      })
    )
  );

  const decoded = (result as E.Right<jwt.JwtPayload>).right;
  expect((decoded.exp ?? 0) - (decoded.iat ?? 0)).toEqual(standardJWTTTL);
};
