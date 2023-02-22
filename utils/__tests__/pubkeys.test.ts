import { JwkPubKeyHashAlgorithmEnum } from "../../generated/definitions/internal/JwkPubKeyHashAlgorithm";
import {
  aSha256PubKeyThumbprint,
  aSha384PubKeyThumbprint,
  aSha512PubKey,
  aSha512PubKeyThumbprint
} from "../../__mocks__/jwkMock";
import { calculateAssertionRef, pubKeyToAlgos } from "../pubkeys";
import * as jose from "../../utils/jose";
import * as TE from "fp-ts/TaskEither";

const anError = new Error("an Error");

describe("pubKeyToAlgos", () => {
  test("GIVEN a pub_key with master algo WHEN pubKeyToAlgos THEN return an array with only the master pub_key", async () => {
    const pubKey = aSha512PubKey;
    const algos = pubKeyToAlgos(pubKey);
    expect(algos).toHaveLength(1);
    expect(algos).toEqual([pubKey]);
  });

  test("GIVEN a pub_key with non-master algo WHEN pubKeyToAlgos THEN return an array with both the input and the master pub_keys", async () => {
    const pubKey = {
      ...aSha512PubKey,
      algo: JwkPubKeyHashAlgorithmEnum.sha256
    };
    const algos = pubKeyToAlgos(pubKey);
    expect(algos).toHaveLength(2);
    expect(algos).toEqual([pubKey, aSha512PubKey]);
  });
});

describe("calculateAssertionRef", () => {
  beforeEach(() => {
    jest.spyOn(jose, "calculateThumbprint").mockRestore();
  });

  test.each([
    {
      pubKey: aSha512PubKey,
      expected: `${String(
        JwkPubKeyHashAlgorithmEnum.sha512
      )}-${aSha512PubKeyThumbprint}`
    },
    {
      pubKey: { ...aSha512PubKey, algo: JwkPubKeyHashAlgorithmEnum.sha384 },
      expected: `${String(
        JwkPubKeyHashAlgorithmEnum.sha384
      )}-${aSha384PubKeyThumbprint}`
    },
    {
      pubKey: { ...aSha512PubKey, algo: JwkPubKeyHashAlgorithmEnum.sha256 },
      expected: `${String(
        JwkPubKeyHashAlgorithmEnum.sha256
      )}-${aSha256PubKeyThumbprint}`
    }
  ])(
    "GIVEN a pub_key $pubKey WHEN calculateAssertionRef THEN return the assertion ref",
    async ({ pubKey, expected }) => {
      const assertionRef = await calculateAssertionRef(pubKey)();
      expect(assertionRef).toEqual(
        expect.objectContaining({
          right: expected
        })
      );
    }
  );

  test("GIVEN a not working jose WHEN calculateAssertionRef is called THEN return the assertion ref", async () => {
    jest
      .spyOn(jose, "calculateThumbprint")
      .mockImplementation(() => () => TE.left(anError));

    const pubKey = aSha512PubKey;
    const assertionRef = await calculateAssertionRef(pubKey)();
    expect(assertionRef).toEqual(
      expect.objectContaining({
        left: anError
      })
    );
  });
});
