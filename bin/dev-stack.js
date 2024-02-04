#!/usr/bin/env node

import { App } from "aws-cdk-lib";
import { DevStack } from "../lib/dev-stack-lib.js";
import { config } from "dotenv";

config();

const app = new App();
new DevStack(app, "DevStack", {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  stackName: "DevStack",
  description: "A Stack where development takes place.",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});
