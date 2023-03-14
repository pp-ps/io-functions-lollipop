import * as crypto from "crypto";
import { JsonWebKey } from "crypto";
import {
  AlgorithmTypes,
  verifyEcdsaSha256
} from "@mattrglobal/http-signatures";

// ----------------------
// Custom Verifiers
// ----------------------

export const verifyRsaPssSha256 = (key: JsonWebKey) => async (
  data: Uint8Array,
  signature: Uint8Array
): Promise<boolean> => {
  const keyObject = crypto.createPublicKey({ format: "jwk", key });
  return crypto
    .createVerify("SHA256")
    .update(data)
    .verify(
      {
        dsaEncoding: "ieee-p1363",
        key: keyObject,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING
      },
      signature
    );
};

export type SupportedAlgTypes = keyof typeof myAlgMap;

const isSupportedAlg = (alg: string): alg is SupportedAlgTypes =>
  alg === "ecdsa-p256-sha256" || alg === "rsa-pss-sha256";

export const myAlgMap = {
  ["ecdsa-p256-sha256"]: {
    verify: verifyEcdsaSha256
  },
  ["rsa-pss-sha256"]: {
    verify: verifyRsaPssSha256
  }
};

export const customVerify = (keyMap: {
  readonly [keyid: string]: { readonly key: JsonWebKey };
}) => async (
  signatureParams: { readonly keyid: string; readonly alg: AlgorithmTypes },
  data: Uint8Array,
  signature: Uint8Array
): Promise<boolean> => {
  if (!isSupportedAlg(signatureParams.alg)) {
    throw new Error("Unsupported algorithm");
  }
  if (keyMap[signatureParams.keyid] === undefined) {
    return Promise.resolve(false);
  }
  return myAlgMap[signatureParams.alg].verify(
    keyMap[signatureParams.keyid].key
  )(data, signature);
};
