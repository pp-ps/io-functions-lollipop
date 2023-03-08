import * as express from "express";
import { withRequestMiddlewares } from "@pagopa/ts-commons/lib/request_middleware";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { RequiredBodyPayloadMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_body_payload";
import { wrapRequestHandler } from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import * as TE from "fp-ts/TaskEither";
import * as RA from "fp-ts/ReadonlyArray";
import {
  JwkPublicKey,
  JwkPublicKeyFromToken
} from "@pagopa/ts-commons/lib/jwk";
import { flow, pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/Either";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { SignedMessagePayload } from "../generated/definitions/lollipop-first-consumer/SignedMessagePayload";
import { SignedMessageResponse } from "../generated/definitions/lollipop-first-consumer/SignedMessageResponse";
import { Client } from "../generated/definitions/external/client";
import {
  LollipopHeaders,
  RequiredHeaderMiddleware,
  RequiredHeadersMiddleware
} from "../utils/middleware/required_header";
import { HttpMessageSignatureMiddleware } from "../utils/middleware/http_message_signature_middleware";
import { JwkPubKey } from "../generated/definitions/internal/JwkPubKey";
import { LollipopAuthBearer } from "../generated/definitions/external/LollipopAuthBearer";
import {
  AssertionType,
  AssertionTypeEnum
} from "../generated/definitions/internal/AssertionType";
import { LCUserInfo } from "../generated/definitions/external/LCUserInfo";
import { SamlUserInfo } from "../generated/definitions/external/SamlUserInfo";
import {
  getFiscalNumberFromSamlResponse,
  getRequestIDFromSamlResponse
} from "../utils/saml";
import {
  calculateAssertionRef,
  getAlgoFromAssertionRef
} from "../utils/lollipopKeys";
import { AssertionRef } from "../generated/definitions/internal/AssertionRef";
import { FirstLcAssertionClientConfig } from "../utils/config";

type ISignedMessageHandler = (
  pubKey: JwkPublicKey,
  lollipopHeaders: LollipopHeaders,
  inputPubkeys: SignedMessagePayload
) => Promise<
  | IResponseSuccessJson<SignedMessageResponse>
  | IResponseErrorValidation
  | IResponseErrorInternal
>;

// eslint-disable-next-line @typescript-eslint/naming-convention
interface VerifierInput {
  readonly assertionXml: string;
  readonly assertionDoc: Document;
}

type Verifier = (
  assertion: VerifierInput
) => TE.TaskEither<IResponseErrorInternal, true>;

type AssertionClient = Client<"ApiKeyAuth">;

export const getAssertionRefVsInRensponseToVerifier = (
  pubKey: JwkPubKey,
  assertionRefFromHeader: AssertionRef
): Verifier => ({ assertionDoc }): ReturnType<Verifier> =>
  pipe(
    assertionDoc,
    getRequestIDFromSamlResponse,
    TE.fromOption(() =>
      ResponseErrorInternal(
        "Missing request id in the retrieved saml assertion."
      )
    ),
    TE.filterOrElse(AssertionRef.is, () =>
      ResponseErrorInternal(
        "InResponseTo in the assertion do not contains a valid Assertion Ref."
      )
    ),
    TE.bindTo("inResponseTo"),
    TE.bind("algo", ({ inResponseTo }) =>
      TE.of(getAlgoFromAssertionRef(inResponseTo))
    ),
    TE.chain(({ inResponseTo, algo }) =>
      pipe(
        pubKey,
        calculateAssertionRef(algo),
        TE.mapLeft(e =>
          ResponseErrorInternal(
            `Error calculating the hash of the provided public key: ${e.message}`
          )
        ),
        TE.filterOrElse(
          calcAssertionRef =>
            calcAssertionRef === inResponseTo &&
            assertionRefFromHeader === inResponseTo,
          calcAssertionRef =>
            ResponseErrorInternal(
              `The hash of provided public key do not match the InReponseTo in the assertion: fromSaml=${inResponseTo},fromPublicKey=${calcAssertionRef},fromHeader=${assertionRefFromHeader}`
            )
        )
      )
    ),
    TE.map(() => true as const)
  );

export const getAssertionUserIdVsCfVerifier = (
  fiscalCodeFromHeader: FiscalCode
): Verifier => ({ assertionDoc }): ReturnType<Verifier> =>
  pipe(
    assertionDoc,
    getFiscalNumberFromSamlResponse,
    TE.fromOption(() =>
      ResponseErrorInternal(
        "Missing or invalid Fiscal Code in the retrieved saml assertion."
      )
    ),
    TE.filterOrElse(
      fiscalCodeFromAssertion =>
        fiscalCodeFromAssertion === fiscalCodeFromHeader,
      fiscalCodeFromAssertion =>
        ResponseErrorInternal(
          `The provided user id do not match the fiscalNumber in the assertion: fromSaml=${fiscalCodeFromAssertion},fromHeader=${fiscalCodeFromHeader}`
        )
    ),
    TE.map(() => true as const)
  );

export const getAssertionSignatureVerifier = (
  _firstLcAssertionClientConfig: FirstLcAssertionClientConfig
): Verifier => (): ReturnType<Verifier> => TE.of(true);

// export const IdpKeysSpidPayload = t.array(
//   t.union([t.literal("latest"), NonNegativeIntegerFromString])
// );

// export const IntervalFromTimestamps = new t.Type<ReadonlyArray<Interval>>(
//   "IntervalFromTimestamps",
//   t.array(t.type({ end: t.number, start: t.number })).is,
//   (input, _context) =>
//     pipe(
//       input,
//       IdpKeysSpidPayload.decode,
//       E.map(
//         A.map(timestamp =>
//           timestamp === "latest" ? Number.MAX_SAFE_INTEGER : timestamp
//         )
//       ),
//       E.map(timestamps => [...timestamps, 0]),
//       E.map(timestamps =>
//         timestamps.reduce(
//           (prev, el, index, all) =>
//             all[index + 1] === undefined
//               ? prev
//               : [...prev, { end: el, start: all[index + 1] + 1 }],
//           [] as ReadonlyArray<Interval>
//         )
//       )
//     ),
//   identity
// );

// export const getAssertionSignatureVerifier = ({
//   IDP_KEYS_BASE_URL
// }: FirstLcAssertionClientConfig): Verifier => ({
//   assertionXml,
//   assertionDoc
// }): ReturnType<Verifier> => {
//   const aaa = pipe(
//     TE.tryCatch(
//       () => fetch(`${IDP_KEYS_BASE_URL}/spid`),
//       flow(E.toError, e =>
//         ResponseErrorInternal(
//           `Error retrieving the spid metadata list from idp-keys: ${e.message}`
//         )
//       )
//     ),
//     TE.chain(response =>
//       TE.tryCatch(
//         () => response.json(),
//         flow(E.toError, e =>
//           ResponseErrorInternal(`idp-keys do not returned a valid json.`)
//         )
//       )
//     ),
//     TE.chain(
//       flow(
//         IntervalFromTimestamps.decode,
//         E.mapLeft(readableReportSimplified),
//         E.mapLeft(ResponseErrorInternal),
//         TE.fromEither
//       )
//     ),
//     TE.bindTo("intervals"),
//     TE.bind("assertionIssueIstant", () =>
//       pipe(
//         getIssueIstantInSecondsFromSamlResponse(assertionDoc),
//         TE.fromOption(() =>
//           ResponseErrorInternal(
//             "Missing or invalid IssueIstant in the retrieved assertion"
//           )
//         )
//       )
//     ),
//     TE.map(({ intervals, assertionIssueIstant }) =>
//       intervals.find(interval =>
//         isWithinInterval(assertionIssueIstant, interval)
//       )
//     ),
//     TE.chain(
//       TE.fromNullable(
//         ResponseErrorInternal(
//           "The IssueIstant in the assertion do not match with any intervals from idp-keys"
//         )
//       )
//     ),
//     TE.map(interval =>
//       interval.end === Number.MAX_SAFE_INTEGER ? "latest" : String(interval.end)
//     ),
//     TE.chain(end =>
//       TE.tryCatch(
//         () => fetch(`${IDP_KEYS_BASE_URL}spid/${end}`),
//         flow(E.toError, e =>
//           ResponseErrorInternal(
//             `Error retrieving the spid metadata for ${end}: ${e.message}`
//           )
//         )
//       )
//     ),
//     TE.chain(response =>
//       response.status === 200
//         ? TE.tryCatch(
//             () => response.text(),
//             flow(E.toError, e =>
//               ResponseErrorInternal(
//                 `The idp-keys returned a not valid text: ${e.message}`
//               )
//             )
//           )
//         : TE.left(
//             ResponseErrorInternal(
//               `Retrieving metadata from idp-keys returned error ${response.status}`
//             )
//           )
//     ),
//     TE.chain(metadataXml =>
//       TE.tryCatch(
//         async () => new DOMParser().parseFromString(metadataXml, "text/xml"),
//         () =>
//           ResponseErrorInternal("Error parsing retrieved idp metadata response")
//       )
//     ),
//     TE.bindTo("metadataDoc"),
//     TE.bind("issuerFromAssertion", () =>
//       pipe(
//         assertionDoc,
//         getIssuerFromSamlResponse,
//         TE.fromOption(() =>
//           ResponseErrorInternal(
//             "Missing or invalid Issuer in the retrieved assertion"
//           )
//         )
//       )
//     ),
//     TE.chain(({ metadataDoc, issuerFromAssertion }) =>
//       pipe(
//         metadataDoc.evaluate(
//           `//EntityDescriptor[@entityID='${issuerFromAssertion}']/Signature/SignedInfo/KeyInfo/X509Data/X509Certificate`,
//           metadataDoc
//         ),
//         issuerCertificate => issuerCertificate.stringValue,
//         NonEmptyString.decode,
//         E.mapLeft(() =>
//           ResponseErrorInternal(
//             `Missing issuer certificate in the idp metadata from idp-keys for: ${issuerFromAssertion}`
//           )
//         ),
//         TE.fromEither
//       )
//     )
//   );
//   TE.left(ResponseErrorInternal("Not Implemented"));
// };

export const isAssertionSaml = (type: AssertionType) => (
  assertion: LCUserInfo
): assertion is SamlUserInfo =>
  type === AssertionTypeEnum.SAML && SamlUserInfo.is(assertion);

export const signedMessageHandler = (
  assertionClient: AssertionClient,
  firstLcAssertionClientConfig: FirstLcAssertionClientConfig
): ISignedMessageHandler => async (
  pubKey,
  lollipopHeaders,
  _inputSignedMessage
): ReturnType<ISignedMessageHandler> =>
  pipe(
    lollipopHeaders,
    TE.fromPredicate(
      headers =>
        headers["x-pagopa-lollipop-original-method"] ===
          firstLcAssertionClientConfig.EXPECTED_FIRST_LC_ORIGINAL_METHOD &&
        headers["x-pagopa-lollipop-original-url"] ===
          firstLcAssertionClientConfig.EXPECTED_FIRST_LC_ORIGINAL_URL.href,
      headers =>
        ResponseErrorInternal(
          `Unexpected original method and/or original url: ${headers["x-pagopa-lollipop-original-method"]}, ${headers["x-pagopa-lollipop-original-url"]}`
        )
    ),
    TE.chain(() =>
      TE.tryCatch(
        () =>
          assertionClient.getAssertion({
            // eslint-disable-next-line sonarjs/no-duplicate-string
            assertion_ref: lollipopHeaders["x-pagopa-lollipop-assertion-ref"],
            ["x-pagopa-lollipop-auth"]: `Bearer ${lollipopHeaders["x-pagopa-lollipop-auth-jwt"]}` as LollipopAuthBearer
          }),
        flow(E.toError, e =>
          ResponseErrorInternal(`Error retrieving assertion: ${e.message}`)
        )
      )
    ),
    TE.chainEitherK(
      E.mapLeft(
        flow(readableReportSimplified, readableError =>
          ResponseErrorInternal(
            `Error decoding retrieved assertion: ${readableError}`
          )
        )
      )
    ),
    TE.chain(response =>
      response.status === 200
        ? TE.right(response.value)
        : TE.left(
            ResponseErrorInternal(
              `Retrieving Assertion returned error ${response.status}: ${response.value?.title},${response.value?.detail}`
            )
          )
    ),
    TE.filterOrElse(
      isAssertionSaml(lollipopHeaders["x-pagopa-lollipop-assertion-type"]),
      () => ResponseErrorInternal("OIDC Claims not supported yet.")
    ),
    TE.map(assertion => assertion.response_xml),
    TE.bindTo("assertionXml"),
    TE.bind("assertionDoc", ({ assertionXml }) =>
      TE.tryCatch(
        async () => new DOMParser().parseFromString(assertionXml, "text/xml"),
        () => ResponseErrorInternal("Error parsing retrieved saml response")
      )
    ),
    TE.chain(verifierInput =>
      pipe(
        [
          getAssertionRefVsInRensponseToVerifier(
            pubKey,
            lollipopHeaders["x-pagopa-lollipop-assertion-ref"]
          ),
          getAssertionUserIdVsCfVerifier(
            lollipopHeaders["x-pagopa-lollipop-user-id"]
          ),
          getAssertionSignatureVerifier(firstLcAssertionClientConfig)
        ],
        RA.map(verifier => verifier(verifierInput)),
        TE.sequenceArray
      )
    ),
    TE.map(() =>
      ResponseSuccessJson({
        response: lollipopHeaders["x-pagopa-lollipop-assertion-ref"]
      })
    ),
    TE.toUnion
  )();

export const getSignedMessageHandler = (
  assertionClient: AssertionClient,
  firstLcAssertionClientConfig: FirstLcAssertionClientConfig
): express.RequestHandler => {
  const handler = signedMessageHandler(
    assertionClient,
    firstLcAssertionClientConfig
  );
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    RequiredHeaderMiddleware(
      "x-pagopa-lollipop-public-key",
      JwkPublicKeyFromToken
    ),
    RequiredHeadersMiddleware(LollipopHeaders),
    RequiredBodyPayloadMiddleware(SignedMessagePayload),
    HttpMessageSignatureMiddleware()
  );
  return wrapRequestHandler(
    middlewaresWrap((_, pubKey, lollipopHeaders, inputSignedMessage, __) =>
      handler(pubKey, lollipopHeaders, inputSignedMessage)
    )
  );
};
