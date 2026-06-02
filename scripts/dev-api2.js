process.env.PORT = process.env.PORT ?? "4001";

require("ts-node/register");
require("../api-routes-v2.ts");
