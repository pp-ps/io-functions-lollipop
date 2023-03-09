import * as express from "express";

import * as E from "fp-ts/Either";

import { HttpMessageSignatureMiddleware } from "../http_message_signature_middleware";
import {
  aValidPayload,
  validLollipopHeaders,
  validMultisignatureHeaders
} from "../../../__mocks__/lollipopSignature.mock";

describe("HttpMessageSignatureMiddleware", () => {
  test(`GIVEN a request with a signature
  WHEN the signature is valid
  THEN the middleware return true`, async () => {
    const mockReq = ({
      app: {
        get: () => ({
          bindings: {
            req: { rawBody: Buffer.from(JSON.stringify(aValidPayload)) }
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

  test(`GIVEN a request with a multi-signature
  WHEN all the signatures are valid
  THEN the middleware return true`, async () => {
    const mockReq = ({
      app: {
        get: () => ({
          bindings: {
            req: { rawBody: Buffer.from(JSON.stringify(aValidPayload)) }
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
