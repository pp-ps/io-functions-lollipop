import { Context } from "@azure/functions";
import * as express from "express";

import { secureExpressApp } from "@pagopa/io-functions-commons/dist/src/utils/express";
import { setAppContext } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";

import createAzureFunctionHandler from "@pagopa/express-azure-functions/dist/src/createAzureFunctionsHandler";

import { createBlobService } from "azure-storage";
import { cosmosdbInstance } from "../utils/cosmosdb";
import {
  LolliPOPKeysModel,
  LOLLIPOPKEYS_COLLECTION_NAME
} from "../model/lollipop_keys";
import { getConfigOrThrow } from "../utils/config";
import {
  getAssertionReader,
  getPublicKeyDocumentReader
} from "../utils/readers";
import { createLogger } from "../utils/logger";
import { initTelemetryClient } from "../utils/appinsights";

import { GetAssertion } from "./handler";

const config = getConfigOrThrow();

const telemetryClient = initTelemetryClient(
  config.APPINSIGHTS_INSTRUMENTATIONKEY
);

const lollipopKeysModel = new LolliPOPKeysModel(
  cosmosdbInstance.container(LOLLIPOPKEYS_COLLECTION_NAME)
);

const assertionBlobService = createBlobService(
  config.LOLLIPOP_ASSERTION_STORAGE_CONNECTION_STRING
);

// Setup Express
const app = express();
secureExpressApp(app);

app.get(
  "/api/v1/assertions/:assertion_ref",
  GetAssertion(
    config,
    getPublicKeyDocumentReader(lollipopKeysModel),
    getAssertionReader(
      assertionBlobService,
      config.LOLLIPOP_ASSERTION_STORAGE_CONTAINER_NAME
    ),
    createLogger(telemetryClient)
  )
);

const azureFunctionHandler = createAzureFunctionHandler(app);

// Binds the express app to an Azure Function handler
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
function httpStart(context: Context): void {
  setAppContext(app, context);
  azureFunctionHandler(context);
}

export default httpStart;
