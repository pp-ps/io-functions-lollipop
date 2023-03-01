import * as jwt from "jsonwebtoken";

import * as E from "fp-ts/Either";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import {
  AuthJWT,
  getGenerateAuthJWT,
  getValidateAuthJWT,
  verifyJWTMiddleware
} from "../auth_jwt";

import { JWTConfig } from "../config";

import { aPrimaryKey, aSecondaryKey } from "../../__mocks__/keys";
import { getGenerateJWT } from "../jwt_with_key_rotation";
import { Second } from "@pagopa/ts-commons/lib/units";
import { pipe } from "fp-ts/lib/function";

const issuer = "test-issuer" as NonEmptyString;
const standardJWTTTL = 900 as Second;

const aPayload = {
  assertionRef: "sha256-p1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c",
  operationId: "anOperationId"
} as AuthJWT;

const aConfigWithPrimaryKey = pipe(
  JWTConfig.decode({
    ISSUER: issuer,
    PRIMARY_PRIVATE_KEY: aPrimaryKey.privateKey,
    PRIMARY_PUBLIC_KEY: aPrimaryKey.publicKey
  }),
  E.getOrElseW(_ => {
    throw Error("Cannot decode IConfig " + JSON.stringify(_));
  })
);

const aConfigWithTwoPrimaryKeys = {
  ...aConfigWithPrimaryKey,
  SECONDARY_PUBLIC_KEY: aSecondaryKey.publicKey
};

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

    expect(E.isRight(token)).toBeTruthy();
    if (E.isRight(token)) {
      // Test
      const result = await getValidateAuthJWT(aConfigWithPrimaryKey)(
        token.right
      )();
      checkDecodedToken(result);
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

    expect(E.isRight(token)).toBeTruthy();
    if (E.isRight(token)) {
      // Test
      const result = await getValidateAuthJWT(aConfigWithPrimaryKey)(
        token.right
      )();

      expect(result).toMatchObject(
        E.left(E.toError("Invalid AuthJWT payload"))
      );
    }
  });
});

describe("VerifyJWTMiddleware", () => {
  it("\
    GIVEN a Valid jwtConfig and a valid x-pagopa-lollipop-auth\
    WHEN VerifyJWTMiddleware is called\
    THEN it should return a valid AuthJWT\
    ", async () => {
    const authJwt = await getGenerateAuthJWT(aConfigWithPrimaryKey)(aPayload)();
    expect(E.isRight(authJwt)).toBeTruthy();

    const middleware = verifyJWTMiddleware(aConfigWithTwoPrimaryKeys);

    if (E.isRight(authJwt)) {
      const req = {
        headers: {
          "x-pagopa-lollipop-auth": `Bearer ${authJwt.right}`
        }
      } as any;

      expect(await middleware(req)).toMatchObject({
        _tag: "Right",
        right: expect.objectContaining({
          assertionRef: "sha256-p1NY7sl1d4lGvcTyYS535aZR_iJCleEIHFRE2lCHt-c",
          operationId: "anOperationId",
          iss: "test-issuer"
        })
      });
    }
  });

  it("\
    GIVEN a Valid jwtConfig and an empty x-pagopa-lollipop-auth\
    WHEN VerifyJWTMiddleware is called\
    THEN it should return a IResponseErrorValidation\
    ", async () => {
    const authJwt = await getGenerateAuthJWT(aConfigWithPrimaryKey)(aPayload)();
    expect(E.isRight(authJwt)).toBeTruthy();

    const middleware = verifyJWTMiddleware(aConfigWithTwoPrimaryKeys);

    if (E.isRight(authJwt)) {
      const req = {
        headers: {
          "x-pagopa-lollipop-auth": ""
        }
      } as any;

      expect(await middleware(req)).toMatchObject({
        _tag: "Left",
        left: expect.objectContaining({
          kind: "IResponseErrorValidation",
          detail:
            'LollipopAuthBearer decode failed: value "" at root is not a valid [string that matches the pattern "^Bearer [a-zA-Z0-9-_].+"]'
        })
      });
    }
  });

  it("\
    GIVEN a Valid jwtConfig and an invalid x-pagopa-lollipop-auth\
    WHEN VerifyJWTMiddleware is called\
    THEN it should return a IResponseErrorValidation containing LollipopAuthBearer decode failed\
    ", async () => {
    const authJwt = await getGenerateAuthJWT(aConfigWithPrimaryKey)(aPayload)();
    const invalidAuth = "invalidAuth";
    expect(E.isRight(authJwt)).toBeTruthy();

    const middleware = verifyJWTMiddleware(aConfigWithTwoPrimaryKeys);

    if (E.isRight(authJwt)) {
      const req = {
        headers: {
          "x-pagopa-lollipop-auth": invalidAuth
        }
      } as any;

      expect(await middleware(req)).toMatchObject({
        _tag: "Left",
        left: expect.objectContaining({
          kind: "IResponseErrorValidation",
          detail: expect.stringContaining("LollipopAuthBearer decode failed")
        })
      });
    }
  });

  it("\
    GIVEN a Valid jwtConfig and an x-pagopa-lollipop-auth valid ONLY for regex pattern\
    WHEN VerifyJWTMiddleware is called\
    THEN it should return a IResponseErrorValidation containing Invalid authJWT\
    ", async () => {
    const authJwt = await getGenerateAuthJWT(aConfigWithPrimaryKey)(aPayload)();
    const invalidAuth = "Bearer aa";
    expect(E.isRight(authJwt)).toBeTruthy();

    const middleware = verifyJWTMiddleware(aConfigWithTwoPrimaryKeys);

    if (E.isRight(authJwt)) {
      const req = {
        headers: {
          "x-pagopa-lollipop-auth": invalidAuth
        }
      } as any;

      expect(await middleware(req)).toMatchObject({
        _tag: "Left",
        left: expect.objectContaining({
          kind: "IResponseErrorValidation",
          detail: expect.stringContaining("Invalid authJWT")
        })
      });
    }
  });
});

// -------------------
// private methods
// -------------------

const checkDecodedToken = async (result: E.Either<Error, AuthJWT>) => {
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
