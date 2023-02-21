import { AzureFunction, Context } from "@azure/functions";
import { LolliPOPKeysModel } from "../model/lollipop_keys";
import { initTelemetryClient } from "../utils/appinsights";
import { getConfigOrThrow } from "../utils/config";
import { cosmosdbInstance } from "../utils/cosmosdb";
import { Failure } from "../utils/errors";
import { handleRevoke } from "./handler";

const config = getConfigOrThrow();

const lollipopKeysModel = new LolliPOPKeysModel(
  cosmosdbInstance.container("PIPPO")
);

const telemetryClient = initTelemetryClient(
  config.APPINSIGHTS_INSTRUMENTATIONKEY
);

export const index: AzureFunction = (
  context: Context,
  rawRevokeMessage: unknown
): Promise<Failure | void> =>
  handleRevoke(context, telemetryClient, lollipopKeysModel, rawRevokeMessage);

export default index;
