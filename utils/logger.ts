import { TelemetryClient } from "applicationinsights";

import * as t from "io-ts";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { AssertionRef } from "../generated/definitions/internal/AssertionRef";

export const GetAssertionCommonProps = t.type({
  assertion_ref: AssertionRef,
  operation_id: NonEmptyString,
  subscription_id: NonEmptyString
});

export const GetAssertionInfo = t.type({
  name: t.literal("lollipop.info.get-assertion"),
  properties: t.intersection([
    GetAssertionCommonProps,
    t.type({
      fiscal_code: NonEmptyString
    })
  ])
});

export const GetAssertionError = t.type({
  name: t.literal("lollipop.error.get-assertion"),
  properties: t.intersection([
    GetAssertionCommonProps,
    t.type({
      error: NonEmptyString
    }),
    t.partial({
      fiscal_code: NonEmptyString,
      message: NonEmptyString
    })
  ])
});

export const BusinessEvent = t.union([GetAssertionInfo, GetAssertionError]);
export type BusinessEvent = t.TypeOf<typeof BusinessEvent>;

export interface ILogger {
  /**
   * Track an BusinessEvent
   *
   * @param e a BusinessEvent
   */
  readonly trackEvent: (e: BusinessEvent) => void;
}

/**
 * return an ILogger based on Telemetry Client
 */
export const createLogger = (telemetryClient: TelemetryClient): ILogger => ({
  trackEvent: (e): void => {
    telemetryClient.trackEvent({
      name: e.name,
      properties: e.properties,
      tagOverrides: { samplingEnabled: "false" }
    });
  }
});
