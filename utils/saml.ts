import * as O from "fp-ts/lib/Option";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { flow, pipe } from "fp-ts/lib/function";
import { xpath as select, SignedXml, FileKeyInfo } from "xml-crypto";
import { IsoDateFromString } from "@pagopa/ts-commons/lib/dates";
import * as TE from "fp-ts/TaskEither";
import {
  IResponseErrorInternal,
  ResponseErrorInternal
} from "@pagopa/ts-commons/lib/responses";
import * as E from "fp-ts/Either";
import { FiscalCode } from "../generated/definitions/internal/FiscalCode";

const SAML_NAMESPACE = {
  ASSERTION: "urn:oasis:names:tc:SAML:2.0:assertion",
  PROTOCOL: "urn:oasis:names:tc:SAML:2.0:protocol"
};

export const getAttributeFromSamlResponse = (
  tagName: string,
  attrName: string
) => (doc: Document): O.Option<string> =>
  pipe(
    O.fromNullable(
      doc.getElementsByTagNameNS(SAML_NAMESPACE.PROTOCOL, tagName).item(0)
    ),
    O.chain(element =>
      O.fromEither(NonEmptyString.decode(element.getAttribute(attrName)))
    )
  );

export const getIssueIstantInSecondsFromSamlResponse = flow(
  getAttributeFromSamlResponse("Assertion", "IssueInstant"),
  IsoDateFromString.decode,
  O.fromEither,
  O.map(date => Math.floor(date.getTime() / 1000))
);

export const getRequestIDFromSamlResponse = getAttributeFromSamlResponse(
  "SubjectConfirmationData",
  "InResponseTo"
);

export const getFiscalNumberFromSamlResponse = (
  doc: Document
): O.Option<FiscalCode> =>
  pipe(
    O.fromNullable(
      doc.getElementsByTagNameNS(SAML_NAMESPACE.ASSERTION, "Attribute")
    ),
    O.chainNullableK(collection =>
      Array.from(collection).find(
        elem => elem.getAttribute("Name") === "fiscalNumber"
      )
    ),
    O.chainNullableK(fiscalCodeElement =>
      fiscalCodeElement.textContent?.trim().replace("TINIT-", "")
    ),
    O.chain(fiscalCode => O.fromEither(FiscalCode.decode(fiscalCode)))
  );

export const getIssuerFromSamlResponse = (
  doc: Document
): O.Option<NonEmptyString> =>
  pipe(
    doc.evaluate("//Response/Assertion/Issuer", doc),
    issuer => issuer.stringValue,
    NonEmptyString.decode,
    O.fromEither
  );

// const spidIdpKeyInfo = (certificateInBase64: NonEmptyString): FileKeyInfo => {
//   const toPem = (): string =>
//     `-----BEGIN CERTIFICATE-----\n${certificateInBase64}-----END CERTIFICATE-----`;

//   return {
//     file: "input://certificateInBase64",
//     getKey: (_keyInfo: Node): Buffer => Buffer.from(toPem()),
//     getKeyInfo: (_key: string, _prefix: string = ""): string => ""
//   };
// };

// const checkSignature = (certificateInBase64: NonEmptyString) => (
//   signature: string | Node,
//   xml: NonEmptyString
// ): E.Either<IResponseErrorInternal, boolean> =>
//   E.tryCatch(
//     () => {
//       const sig = new SignedXml();
//       // eslint-disable-next-line functional/immutable-data
//       sig.keyInfoProvider = spidIdpKeyInfo(certificateInBase64);
//       sig.loadSignature(signature);
//       return sig.checkSignature(xml);
//     },
//     flow(E.toError, e =>
//       ResponseErrorInternal(
//         `Error during assertion signature check: ${e.message}`
//       )
//     )
//   );

// export const verifySamlSignature = (
//   assertionXml: NonEmptyString,
//   optionalAssertionDoc?: Document
// ) => {
//   const aaa = pipe(
//     optionalAssertionDoc,
//     O.fromNullable,
//     O.map(TE.of),
//     O.getOrElse(() =>
//       TE.tryCatch(
//         async () => new DOMParser().parseFromString(assertionXml, "text/xml"),
//         () => ResponseErrorInternal("Error parsing input saml response")
//       )
//     ),
//     TE.bindTo("assertionDoc"),
//     TE.bind("signature", ({ assertionDoc }) =>
//       pipe(
//         assertionDoc.evaluate(
//           "/Assertion/Signature/SignatureValue",
//           assertionDoc
//         ),
//         signature => signature.stringValue,
//         NonEmptyString.decode,
//         E.mapLeft(() =>
//           ResponseErrorInternal(
//             `Missing assertion signature in the retrieved assertion.`
//           )
//         ),
//         TE.fromEither
//       )
//     ),
//     TE.bind("assertionOnlyXml", ({ assertionDoc }) => {
//       const bbb = pipe(assertionDoc.evaluate("/Assertion", assertionDoc),
//         assertionNode => assertionNode.snapshotItem(0)?.
//       );

//     })
//   );
// };
