declare module "http-signature" {
  import http from "http";

  interface ParsedRequest {}
  interface ParseRequestOption {}

  declare function parseRequest(
    request: http.IncomingMessage,
    options?: ParseRequestOption
  ): ParsedRequest;

  declare function verifySignature(parsed: ParsedRequest, pub: string): boolean;
}
