import { JwkPublicKey } from "@pagopa/ts-commons/lib/jwk";
import { NewPubKeyPayload } from "../generated/definitions/internal/NewPubKeyPayload";
import { JwkPubKeyHashAlgorithmEnum } from "../generated/definitions/internal/JwkPubKeyHashAlgorithm";

export const aJwkPubKey: JwkPublicKey = {
  kty: "EC",
  crv: "secp256k1",
  x: "Q8K81dZcC4DdKl52iW7bT0ubXXm2amN835M_v5AgpSE",
  y: "lLsw82Q414zPWPluI5BmdKHK6XbFfinc8aRqbZCEv0A"
};

export const aNotValidRsaJwkPublicKey: JwkPublicKey = {
  kty: "RSA",
  alg: "alg",
  e: "e",
  n: "n"
};

export const aSha512PubKey: NewPubKeyPayload = {
  algo: JwkPubKeyHashAlgorithmEnum.sha512,
  pub_key: aJwkPubKey
};
export const aSha512PubKeyThumbprint =
  "LWmgzxnrIhywpNW0mctCFWfh2CptjGJJN_H2_FLN2fg";
