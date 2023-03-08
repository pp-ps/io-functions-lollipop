import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";

import { JwkPublicKey } from "@pagopa/ts-commons/lib/jwk";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { UrlFromString, ValidUrl } from "@pagopa/ts-commons/lib/url";

import { LollipopMethodEnum } from "../generated/definitions/lollipop-first-consumer/LollipopMethod";

import { AssertionTypeEnum } from "../generated/definitions/internal/AssertionType";
import { LollipopOriginalURL } from "../generated/definitions/lollipop-first-consumer/LollipopOriginalURL";
import { LollipopSignature } from "../generated/definitions/lollipop-first-consumer/LollipopSignature";
import { LollipopContentDigest } from "../generated/definitions/lollipop-first-consumer/LollipopContentDigest";
import { LollipopSignatureInput } from "../generated/definitions/lollipop-first-consumer/LollipopSignatureInput";

import { FirstLcAssertionClientConfig } from "../utils/config";

import {
  aFiscalCode,
  aValidSha256AssertionRef,
  toEncodedJwk
} from "./lollipopPubKey.mock";

const aValidPublicKey: JwkPublicKey = {
  kty: "EC",
  x: "FqFDuwEgu4MUXERPMVL-85pGv2D3YmL4J1gfMkdbc24",
  y: "hdV0oxmWFSxMoJUDpdihr76rS8VRBEqMFebYyAfK9-k",
  crv: "P-256"
};

export const aValidPayload = {
  message: "a valid message payload" as NonEmptyString
};

export const firstLcAssertionClientConfig: FirstLcAssertionClientConfig = {
  EXPECTED_FIRST_LC_ORIGINAL_METHOD: LollipopMethodEnum.POST,
  EXPECTED_FIRST_LC_ORIGINAL_URL: pipe(
    UrlFromString.decode("https://api-app.io.pagopa.it/first-lollipop/sign"),
    E.getOrElseW(() => {
      throw new Error("Error decoding url");
    })
  ),
  FIRST_LC_ASSERTION_CLIENT_BASE_URL: "assertionClientBaseUrl" as NonEmptyString,
  FIRST_LC_ASSERTION_CLIENT_SUBSCRIPTION_KEY: "aSubscriptionKey" as NonEmptyString,
  IDP_KEYS_BASE_URL: ("https://api.is.eng.pagopa.it/idp-keys" as unknown) as ValidUrl
};

export const validLollipopHeaders = {
  "X-io-sign-qtspclauses": "anIoSignClauses",
  ["x-pagopa-lollipop-assertion-ref"]: aValidSha256AssertionRef,
  ["x-pagopa-lollipop-assertion-type"]: AssertionTypeEnum.SAML,
  ["x-pagopa-lollipop-user-id"]: aFiscalCode,
  ["x-pagopa-lollipop-public-key"]: toEncodedJwk(aValidPublicKey),
  ["x-pagopa-lollipop-auth-jwt"]: "aValidJWT" as NonEmptyString,
  // ---------
  // verified header
  // ---------
  ["x-pagopa-lollipop-original-method"]:
    firstLcAssertionClientConfig.EXPECTED_FIRST_LC_ORIGINAL_METHOD,
  ["x-pagopa-lollipop-original-url"]: firstLcAssertionClientConfig
    .EXPECTED_FIRST_LC_ORIGINAL_URL.href as LollipopOriginalURL,
  ["signature-input"]: `sig1=("content-digest" "x-pagopa-lollipop-original-method" "x-pagopa-lollipop-original-url");created=1678293988;nonce="aNonce";alg="ecdsa-p256-sha256";keyid="sha256-a7qE0Y0DyqeOFFREIQSLKfu5WlbckdxVXKFasfcI-Dg"` as LollipopSignatureInput,
  ["signature"]: "sig1=:lTuoRytp53GuUMOB4Rz1z97Y96gfSeEOm/xVpO39d3HR6lLAy4KYiGq+1hZ7nmRFBt2bASWEpen7ov5O4wU3kQ==:" as LollipopSignature,
  ["content-digest"]: "sha-256=:cpyRqJ1VhoVC+MSs9fq4/4wXs4c46EyEFriskys43Zw=:" as LollipopContentDigest
};
