import * as express from "express";

import * as E from "fp-ts/Either";

import { HttpMessageSignatureMiddleware } from "../http_message_signature_middleware";
import {
  aValidPayload,
  validLollipopHeaders,
  validMultisignatureHeaders
} from "../../../__mocks__/lollipopSignature.mock";
import { aValidSha512AssertionRef } from "../../../__mocks__/lollipopPubKey.mock";

describe("HttpMessageSignatureMiddleware - Success", () => {
  test(`GIVEN a request with a signature
  WHEN the signature is valid and alg is 'ecdsa-p256-sha256'
  THEN the middleware return true`, async () => {
    const mockReq = ({
      app: {
        get: () => ({
          bindings: {
            req: { rawBody: JSON.stringify(aValidPayload) }
          }
        })
      },
      headers: validLollipopHeaders,
      url:
        "https://io-p-weu-lollipop-fn.azurewebsites.net/api/v1/first-lollipop-consumer",
      method: "POST",
      body: aValidPayload
    } as unknown) as express.Request;

    const res = await HttpMessageSignatureMiddleware()(mockReq);

    expect(res).toMatchObject(E.right(true));
  });

  test(`GIVEN a request with a signature
  WHEN the signature is valid and alg is 'rsa-pss-sha256'
  THEN the middleware return true`, async () => {
    const mockReq = ({
      app: {
        get: () => ({
          bindings: {
            req: { rawBody: JSON.stringify(aValidPayload) }
          }
        })
      },
      headers: {
        ...validLollipopHeaders,
        ["x-pagopa-lollipop-assertion-ref"]:
          "sha256-A3OhKGLYwSvdJ2txHi_SGQ3G-sHLh2Ibu91ErqFx_58",
        ["x-pagopa-lollipop-public-key"]:
          "eyJrZXlfb3BzIjpbInZlcmlmeSJdLCJleHQiOnRydWUsImt0eSI6IlJTQSIsIm4iOiJ2dHAwT3p5aGhsSUh2YjFmR0pKVERJSUtVVmtKcTJrOEJuekNJVThhbFdXWnd6bExVUERUUU55OW1CdUFVWndLZUdEam8xSlBuUjJXQzhWLTlOSVkxZzVUYlg5SGJnZk9rd3YzTVl1V0xhZUVBZmdfT0FFTEJjNjhxV0JZdTdxWXpjSlpPZ3dTdWZRNmxidUlFNXhrcnMtY3Fpc08zMGpFQmF0QjNReXJQZEdid0pXOEJ4bTBqQTZlN1NWcDd3NzUtYkdGeElhMkNDOTNuSWl4ZTNMRnNhRU5yX0lnYlNNM2NDcG00VEFYZHVGc1dHWjU2SkdHYkZBak5hV2s3VDJwMU9qd2owX0RVNzZIRUpEWGdNSkp4b3NtaE9GajdUZE95aE0zTVpWSUFUcEswYkZBdFZpcWk1WGxaTUpXY2FscmJpSkNHTjdBdzV2anBTdkpsOTVkVVRuR1ZTQlZXQ1gyVm9hb2FEVV9sTVNUYkw5Sm5HVlZzX3Ywb3dOR0lELVpHNXQ5Yk9ZYWt4MWJjWWN6ZzcyQVd1V3RHTXFtWDFSSDEwTGlEam10NDh0Yml3Q254ZGVRaGFYa19wNVk0bzFpcnpQWG5nUzVJWWlqZXVXdjlzM2hCY3hGQTRPYURGdjRURkoxVExiRGluUmpfa1hCdjEyWDNLRE9iYWNFdDVLcGVsNUluNlZxZHBNNWVFZnZ0WDU4U0Z2bDktTmphb29PZjZUeUJsOEtVdTZOTmc2OXNYQVFRVnBzdXhpaDl3NzA5RVRObWx1M2tZc21iTWt3MVRGM3hnRmxJSDh2SnI2WWJ6ajFxcDJ1djJaYkFtYXBNLUd1NVRTYUNOSzZKbVpvLV95UVA5dDFGOWZldmUxYzFHZWlvdEtXLUpDalRmYnNodkZ0M1V3eUdyOCIsImUiOiJBUUFCIiwiYWxnIjoiUFM1MTIifQ",
        Signature:
          "sig1=:LaN4n+miIZDzPHSV1CwFM/M+qzp0InLYlfxKfOC8b+VMv4q9leZSQcGwLC7uLpvdn4o8q9+LKc6zPbsD6NWtJclbwVLBXJKmpI7OzPkHJhho809JPHiFeQ49o/YfLXGKSlGp0kYmpP6KwsFivkuH54+/I5s5PDJacpQ5J2/j6MeFZH2arft9Kg5ZSOBZdG4EpvAxOrmje8bzIbaptb2DSxdX9YfNiYf6fuMjDnGOVAa3nz8z135tyvPj5tP8P2MKRDKVc2L1sUfpTIJ9HSjcEx6cxhBXdPwozdtVy/we7QXBl+c9fHzCytk3aNlaPh1B10MCwuKQiky8M1GCR1BMC5pIkhXenOcvj7hNkTe1FEwkvLWHCYdJzNLD8ERbTfsKEM1CZt7I5fMBr0/mitOJZ2GBIOnhZZya0oFnR5br22zvXoJL8lS1ajp3Wt3EXSdliDloy5LDOPqxAEH5nXInfxDaYQgZuLWa0I2oLmSr/DlW/KqX0KVCtoJXdwxJjhBS/ZRTdC0u2WmcE0QA0YXeJfUWaU8KS1Nx+Lbz22xEu7kNGTh7r8cmtVzl5bybtpvMUZ7dqNgoW5mcaCUDjeQOinRsugVWVTowTPjJWXW+8cV9LeBJRq4oc9HzoLQDfn/HGoMFpi79pZQIzNFBE3Jpdoouu392AqmEebzEgm2838A=:",
        ["Signature-Input"]:
          'sig1=("content-digest" "x-pagopa-lollipop-original-method" "x-pagopa-lollipop-original-url");created=1678814391;nonce="aNonce";alg="rsa-pss-sha256";keyid="sha256-A3OhKGLYwSvdJ2txHi_SGQ3G-sHLh2Ibu91ErqFx_58"'
      },
      url:
        "https://io-p-weu-lollipop-fn.azurewebsites.net/api/v1/first-lollipop-consumer",
      method: "POST",
      body: aValidPayload
    } as unknown) as express.Request;

    const res = await HttpMessageSignatureMiddleware()(mockReq);

    expect(res).toMatchObject(E.right(true));
  });

  test(`GIVEN a request with a multi-signature
  WHEN all the signatures are valid and alg is 'ecdsa-p256-sha256'
  THEN the middleware return true`, async () => {
    const mockReq = ({
      app: {
        get: () => ({
          bindings: {
            req: { rawBody: JSON.stringify(aValidPayload) }
          }
        })
      },
      headers: validMultisignatureHeaders,
      url:
        "https://io-p-weu-lollipop-fn.azurewebsites.net/api/v1/first-lollipop-consumer",
      method: "POST",
      body: aValidPayload
    } as unknown) as express.Request;

    const res = await HttpMessageSignatureMiddleware()(mockReq);

    expect(res).toMatchObject(E.right(true));
  });
});

describe("HttpMessageSignatureMiddleware - Failures", () => {
  test(`GIVEN a request with a signature
  WHEN the keyid is different from the assertion ref
  THEN the middleware return false`, async () => {
    const mockReq = ({
      app: {
        get: () => ({
          bindings: {
            req: { rawBody: JSON.stringify(aValidPayload) }
          }
        })
      },
      headers: {
        ...validLollipopHeaders,
        ["x-pagopa-lollipop-assertion-ref"]: aValidSha512AssertionRef
      },
      url:
        "https://io-p-weu-lollipop-fn.azurewebsites.net/api/v1/first-lollipop-consumer",
      method: "POST",
      body: aValidPayload
    } as unknown) as express.Request;

    const res = await HttpMessageSignatureMiddleware()(mockReq);

    expect(res).toMatchObject(
      E.left(
        expect.objectContaining({
          detail:
            'Internal server error: Http Message Signature Validation failed: HTTP Request Signature failed {"type":"FailedToVerify","message":"Signatures are well formed but one or more failed to verify."}',
          kind: "IResponseErrorInternal"
        })
      )
    );
  });
});
