import dotenv from "dotenv";
import OpenAI from "openai";
import playwright from "playwright";
import fs from "node:fs";

dotenv.config();

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/115.0",
  "Mozilla/5.0 (Windows NT 10.0; rv:115.0) Gecko/20100101 Firefox/115.0",
];

function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

function extractJsonFromText(text) {
  const jsonStart = text.indexOf("[");
  const jsonEnd = text.lastIndexOf("]");
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    throw new Error("Tidak ditemukan JSON array dalam teks.");
  }
  const jsonString = text.substring(jsonStart, jsonEnd + 1);
  return JSON.parse(jsonString);
}

async function callDeepSeek(htmlContent) {
  //   console.log("html content:", htmlContent);
  const prompt = `
      saya memiliki konten HTML dari halaman hasil pencarian eBay.
      Saya ingin kamu mengekstrak semua produk yang ditampilkan dari halaman ini, **hanya produk nyata (bukan iklan, banner, atau promosi)**.
      Untuk setiap produk saya memerlukan data berikut:
      
      - name: nama produk
      - price: harga produk
      - link: URL menuju halaman detail produk

      **Catatan penting**:
      - Abaikan entri yang tidak memiliki nama produk yang jelas atau hanya bertuliskan "Shop on eBay", "Sponsored", atau bentuk promosi/iklan lainnya.
      - Untuk "link", hanya ambil URL dasar sebelum tanda tanya "?" (hapus semua query string).

      Berikan output hanya dalam format JSON array yang valid, tanpa penjelasan apapun, tanpa narasi, tanpa kode blok. 
      Hanya JSON yang berisi objek produk dengan key: "name", "price", dan "link".

      Contoh output yang diharapkan:
      [
        {
          "name": "...",
          "price": "...",
          "link": "..."
        },
        ...
      ]

      Berikut adalah HTML-nya:
      ${htmlContent}
    `;

  try {
    const response = await openai.chat.completions.create({
      model: "deepseek/deepseek-r1-0528:free",
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.choices[0].message.content;
    console.log("=== Raw response from model ===");
    console.log(text);

    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      return parsed;
    } catch (error) {
      try {
        const parsed = extractJsonFromText(text);
        return parsed;
      } catch (error) {
        console.error("Gagal parsing JSON dengan ekstraksi: ", error.message);
        fs.writeFileSync("raw_response.txt", text);
        fs.writeFileSync("cleaned_response.txt", cleaned);
        fs.writeFileSync("htmlContent.txt", htmlContent);
        return [];
      }
    }
  } catch (e) {
    console.error("Error calling DeepSeek API: ", e);
    return [];
  }
}

async function extractSellerDescription(htmlContent) {
  const prompt = `
   Dari konten HTML berikut, ambil dan kembalikan hanya deskripsi produk dari seller.
   Kembalikan hanya isi deskripsi produk sebagai **teks biasa dalam bentuk paragraf**, tanpa format tambahan, tanpa bullet list, tanpa penjelasan ulang, dan tanpa pembuka atau penutup.
   
   Jangan gunakan format list, markdown, atau penjelasan tambahan. Keluarkan hanya satu paragraf deskripsi bersih

    HTML:
    ${htmlContent}
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "deepseek/deepseek-r1-0528:free",
      messages: [{ role: "user", content: prompt }],
    });

    const desc = response.choices[0].message.content.trim();
    console.log(desc);
    return desc;
  } catch (error) {
    console.error("Error calling DeepSeek API: ", error);
  }
}

async function scrapeProducts(keyword, currentPage) {
  // const UA = new UserAgent();
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: getRandomUserAgent() });
  const page = await context.newPage();

  const url = `https://www.ebay.com/sch/i.html?_from=R40&_nkw=${keyword}&_sacat=0&rt=nc&_pgn=${currentPage}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

  const productHtmlList = await page.$$eval(".s-item", (items) =>
    items.map((item) => item.innerHTML)
  );

  fs.writeFileSync(
    "productHtml.json",
    JSON.stringify(productHtmlList, null, 2)
  );
  await browser.close();

  const batchSize = 5;
  const allProducts = [];

  for (let i = 0; i < productHtmlList.length; i += batchSize) {
    const batch = productHtmlList.slice(i, i + batchSize);
    const parsed = await callDeepSeek(batch);
    allProducts.push(...parsed);
    console.log(`Processed batch ${i / batchSize + 1}`);

    parsed.forEach((product, index) => {
      console.log(` Produk ${i + index + 1}:`);
      console.log(`    Nama  : ${product.name}`);
      console.log(`    Harga : ${product.price}`);
      console.log(`    Link  : ${product.link}`);
    });
  }

  console.log("Mengambil deskripsi detail dari halaman produk...");

  for (let i = 0; i < allProducts.length; i++) {
    const product = allProducts[i];
    try {
      console.log(`Mengambil detail produk dari link: ${product.link}`);
      const detailHtml = await fetchProductPage(product.link);

      console.log(`Mengambil deskripsi produk`);
      const description = await extractSellerDescription(detailHtml);
      product.description = description;
    } catch (error) {
      console.error("Gagal mengambil detail dari: ", product.link);
      product.description = "-";
    }
  }

  fs.writeFileSync("final_products.json", JSON.stringify(allProducts, null, 2));
  console.log(`${allProducts.length} produk disimpan ke data.json`);
  return allProducts;
}

async function fetchProductPage(url) {
  // const UA = new UserAgent();
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: getRandomUserAgent() });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    const descContent = await page.content();
    fs.writeFileSync("detail-page.txt", descContent);

    const iframeLocator = page.locator("#desc_ifr");
    const iframeCount = await iframeLocator.count();

    if (iframeCount > 0) {
      const iframeSrc = await iframeLocator.getAttribute("src");
      if (iframeSrc) {
        const iframeContext = await browser.newContext({
          userAgent: getRandomUserAgent(),
        });
        const iframePage = await iframeContext.newPage();

        try {
          console.log(`Memeriksa description produk...`);
          await iframePage.goto(iframeSrc, {
            timeout: 60000,
            waitUntil: "domcontentloaded",
          });

          const element = await iframePage.$(".x-item-description-child");
          if (element) {
            const detail = await element.innerHTML();
            fs.writeFileSync("description-page.txt", detail);
            await iframePage.close();
            await iframeContext.close();
            await browser.close();
            return detail;
            // const parsed = await extractSellerDescription(detail);
          } else {
            console.warn("Elemen '.x-item-description-child' tidak ditemukan.");
          }
        } catch (err) {
          console.error("Error saat mengambil iframe:", err.message);
        } finally {
          await iframePage.close();
          await iframeContext.close();
        }
      }
    } else {
      console.log("iframe #desc_ifr tidak ditemukan.");
    }
  } catch (error) {
    console.error(`Gagal buka halaman ${url}:`, error.message);
  }

  await browser.close();
  return null;
}

export default { scrapeProducts };
