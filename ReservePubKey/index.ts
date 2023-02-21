import { AzureFunction, Context } from "@azure/functions";
import * as express from "express";
import { secureExpressApp } from "@pagopa/io-functions-commons/dist/src/utils/express";
import { setAppContext } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import createAzureFunctionHandler from "@pagopa/express-azure-functions/dist/src/createAzureFunctionsHandler";
import { cosmosdbInstance } from "../utils/cosmosdb";
import { LolliPOPKeysModel } from "../model/lollipop_keys";
import { getHandler } from "./handler";

// Setup Express
const app = express();
secureExpressApp(app);

const PIPPO = "pippo";
const lollipopPubkeysModel = new LolliPOPKeysModel(
  cosmosdbInstance.container(PIPPO)
);

// Add express route
app.post("/api/v1/pubkeys", getHandler(lollipopPubkeysModel));

const azureFunctionHandler = createAzureFunctionHandler(app);

const httpStart: AzureFunction = (context: Context): void => {
  setAppContext(app, context);
  azureFunctionHandler(context);
};

export default httpStart;
