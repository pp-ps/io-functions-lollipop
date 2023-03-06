import { Context } from "@azure/functions";

export const contextMock = ({
  log: {
    error: jest.fn()
  },
  executionContext: {}
} as unknown) as Context;
