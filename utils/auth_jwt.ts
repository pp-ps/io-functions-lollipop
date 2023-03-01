import * as t from "io-ts";

import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { Second } from "@pagopa/ts-commons/lib/units";
import { IRequestMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorValidation,
  ResponseErrorValidation
} from "@pagopa/ts-commons/lib/responses";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { AssertionRef } from "../generated/definitions/internal/AssertionRef";
import { OperationId } from "../generated/definitions/internal/OperationId";

import { LollipopAuthBearer } from "../generated/definitions/external/LollipopAuthBearer";
import { getGenerateJWT, getValidateJWT } from "./jwt_with_key_rotation";

import { JWTConfig } from "./config";

/**
 * Type Definitions
 */

export type AuthJWT = t.TypeOf<typeof AuthJWT>;
export const AuthJWT = t.interface({
  assertionRef: AssertionRef,
  operationId: OperationId
});

/**
 * AuthJWT Generation
 */
export type GenerateAuthJWT = (
  authJWT: AuthJWT
) => TE.TaskEither<Error, NonEmptyString>;

export const getGenerateAuthJWT = ({
  ISSUER,
  JWT_TTL,
  PRIMARY_PRIVATE_KEY
}: JWTConfig): GenerateAuthJWT =>
  pipe(
    getGenerateJWT(ISSUER, PRIMARY_PRIVATE_KEY),
    generateJWTFunction => (authJWT): ReturnType<GenerateAuthJWT> =>
      generateJWTFunction(authJWT, JWT_TTL as Second)
  );

/**
 * AuthJWT Validation
 */
export type ValidateAuthJWT = (
  token: NonEmptyString
) => TE.TaskEither<Error, AuthJWT>;

export const getValidateAuthJWT = ({
  ISSUER,
  PRIMARY_PUBLIC_KEY,
  SECONDARY_PUBLIC_KEY
}: JWTConfig): ValidateAuthJWT =>
  pipe(
    getValidateJWT(ISSUER, PRIMARY_PUBLIC_KEY, SECONDARY_PUBLIC_KEY),
    validateJWTFunction => (token): ReturnType<ValidateAuthJWT> =>
      pipe(
        validateJWTFunction(token),
        TE.filterOrElse(AuthJWT.is, () => E.toError("Invalid AuthJWT payload"))
      )
  );

/**
 * A middleware that verify the jwt
 *
 * @param jwtConfig the config for the jwt
 * */

export const verifyJWTMiddleware = (
  jwtConfig: JWTConfig
): IRequestMiddleware<"IResponseErrorValidation", AuthJWT> => (
  req
): Promise<E.Either<IResponseErrorValidation, AuthJWT>> =>
  pipe(
    req.headers[jwtConfig.BEARER_AUTH_HEADER],
    LollipopAuthBearer.decode,
    E.mapLeft(e =>
      ResponseErrorValidation(
        "LollipopAuthBearer decode failed",
        readableReportSimplified(e)
      )
    ),
    E.map(authBearer => authBearer.replace("Bearer ", "") as NonEmptyString),
    TE.fromEither,
    TE.chain(token =>
      pipe(
        token,
        getValidateAuthJWT(jwtConfig),
        TE.mapLeft(({ message }) =>
          ResponseErrorValidation("Invalid authJWT", message)
        )
      )
    )
  )();
