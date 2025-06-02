import scraper from "./index.js";

const routes = [
  {
    method: "GET",
    path: "/scrape",
    handler: async (request, h) => {
      const keyword = request.query.keyword || "nike";
      const page = request.query.page || 1;

      try {
        const data = await scraper.scrapeProducts(keyword, page);
        return h.response(data).code(200);
      } catch (e) {
        console.error(e);
        return h.response({ error: "Scraping failed" }).code(500);
      }
    },
  },
];

export default { routes };
