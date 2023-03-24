import { Context } from "@azure/functions";

export const contextMock = ({
  log: {
    error: jest.fn(),
    info: jest.fn(),
    verbose: jest.fn(),
    warn: jest.fn()
  },
  executionContext: {}
} as unknown) as Context;
