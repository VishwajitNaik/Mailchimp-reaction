import mongoConnectWithRetry from "@reactioncommerce/api-core/src/util/mongoConnectWithRetry.js";
import { Mongo } from "@accounts/mongo";
import AccountsServer from "@accounts/server";
import AccountsPassword from "@accounts/password";
import mongoose from "mongoose";
import { AccountsModule } from "@accounts/graphql-api";
import config from "../config.js";

let accountsServer;
let accountsGraphQL;

export default async (app) => {
  if (accountsServer && accountsGraphQL) {
    return { accountsServer, accountsGraphQL };
  }
  const { MONGO_URL, STORE_URL } = config;
  const { context } = app;

  const client = await mongoConnectWithRetry(MONGO_URL);
  const db = client.db();

  const accountsMongo = new Mongo(db, {
    convertUserIdToMongoObjectId: false,
    convertSessionIdToMongoObjectId: false,
    idProvider: () => mongoose.Types.ObjectId().toString()
  });

  const password = new AccountsPassword.AccountsPassword();

  accountsServer = new AccountsServer.AccountsServer(
    {
      siteUrl: STORE_URL,
      db: accountsMongo,
      enableAutologin: true,
      ambiguousErrorMessages: false,
      sendMail: ({ to, text }) => {
        const query = text.split("/");
        const token = query[query.length - 1];
        const url = `${STORE_URL}/?resetToken=${token}`;
        context.mutations.sendResetAccountPasswordEmail(context, { email: to, url });
      },
      emailTemplates: {
        resetPassword: {
          from: null,
          // hack to pass the URL to sendMail function
          text: (user, url) => url
        }
      }
    },
    {
      password
    }
  );
  accountsGraphQL = AccountsModule.forRoot({ accountsServer });
  return { accountsServer, accountsGraphQL };
};
