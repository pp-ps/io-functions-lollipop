import { Context } from "@azure/functions";
import * as express from "express";

import { secureExpressApp } from "@pagopa/io-functions-commons/dist/src/utils/express";
import { setAppContext } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";

import createAzureFunctionHandler from "@pagopa/express-azure-functions/dist/src/createAzureFunctionsHandler";

import { cosmosdbInstance } from "../utils/cosmosdb";
import {
  LolliPOPKeysModel,
  LOLLIPOPKEYS_COLLECTION_NAME
} from "../model/lollipop_keys";
import { getConfigOrThrow } from "../utils/config";
import { getGenerateAuthJWT } from "../utils/auth_jwt";
import { GenerateLCParams } from "./handler";

const lollipopKeysModel = new LolliPOPKeysModel(
  cosmosdbInstance.container(LOLLIPOPKEYS_COLLECTION_NAME)
);

const config = getConfigOrThrow();

// Setup Express
const app = express();
secureExpressApp(app);

app.post(
  "/api/v1/pubKeys/:assertion_ref/generate",
  GenerateLCParams(
    lollipopKeysModel,
    config.KEYS_EXPIRE_GRACE_PERIODS_IN_DAYS,
    getGenerateAuthJWT(config)
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
