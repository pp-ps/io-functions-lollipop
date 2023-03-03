import { generateDigestHeader, constants } from "../crypto";

describe("Content-Digest", () => {
  test("should be able to generate for SHA256 cipher", () => {
    const request: string = '{"hello": "world"}';
    const requestBuffer: Buffer = Buffer.from(request);
    const expected: string =
      "sha-256=:X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=:";

    const actual = generateDigestHeader(requestBuffer, constants.SHA_256);

    expect(actual).toBe(expected);
  });

  test("should be able to generate for SHA512 cipher", () => {
    const request: string = '{"hello": "world"}';
    const requestBuffer: Buffer = Buffer.from(request);
    const expected: string =
      "sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:";

    const actual = generateDigestHeader(requestBuffer, constants.SHA_512);

    expect(actual).toBe(expected);
  });
});
