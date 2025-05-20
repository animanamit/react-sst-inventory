/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "inventory",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      providers: {
        aws: {
          profile: "animan",
        },
      },
      home: "aws",
    };
  },
  async run() {
    new sst.aws.React("MyWeb");
  },
});
