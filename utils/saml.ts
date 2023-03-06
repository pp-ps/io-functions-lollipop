import * as O from "fp-ts/lib/Option";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { pipe } from "fp-ts/lib/function";
import { xpath as select, SignedXml } from "xml-crypto";
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

export const getRequestIDFromSamlResponse = getAttributeFromSamlResponse(
  "Assertion",
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
    O.chainNullableK(_ => _.textContent?.trim().replace("TINIT-", "")),
    O.chain(_ => O.fromEither(FiscalCode.decode(_)))
  );

const SpidIdpKeyInfo = () => ({
  getKey: (_keyInfo: Node): Buffer => {
    //you can use the keyInfo parameter to extract the key in any way you want
    return Buffer.from("");
  },
  getKeyInfo: (_key: string, prefix: string = ""): string => {
    const tagPrefix = prefix ? prefix + ":" : prefix;
    return "<" + tagPrefix + "X509Data></" + tagPrefix + "X509Data>";
  }
});

// const aaa = (doc: Document) => {
//   var signature = select(
//     doc,
//     "//*[local-name(.)='Signature' and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']"
//   )[0];
//   var sig = new SignedXml();
//   sig.keyInfoProvider;
// };

// sig.keyInfoProvider = new FileKeyInfo("client_public.pem");
// sig.loadSignature(signature);
// var res = sig.checkSignature(xml);
// if (!res) console.log(sig.validationErrors);
