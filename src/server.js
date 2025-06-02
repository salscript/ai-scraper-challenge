import Hapi from "@hapi/hapi";
import routes from "./routes.js";

const init = async () => {
  const server = Hapi.server({
    port: 3000,
    host: "localhost",
    routes: {
      cors: {
        origin: ["*"],
      },
    },
  });

  server.route(routes.routes);
  await server.start();
  console.log(`Server berjalan pada ${server.info.uri}`);
};

init();
