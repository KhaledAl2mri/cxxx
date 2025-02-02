const axios = require("axios");
const cheerio = require("cheerio");
const ExcelJS = require("exceljs");
const bwipjs = require("bwip-js");

class ProductScraper {
  constructor() {
    this.workbook = new ExcelJS.Workbook();
    this.worksheet = this.initWorksheet();
    this.rowNumber = 2;
    this.totalPages = 125;
  }

  initWorksheet() {
    const worksheet = this.workbook.addWorksheet("Products", {
      views: [{ rightToLeft: true }],
    });

    worksheet.columns = [
      { header: "الصورة", key: "image", width: 25 },
      { header: "الباركود", key: "barcode", width: 30 },
      { header: "اسم المنتج", key: "name", width: 40 },
      { header: "السعر", key: "price", width: 15 },
      { header: "الرابط", key: "url", width: 50 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 12, color: { argb: "FFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "4472C4" },
    };
    headerRow.height = 30;
    return worksheet;
  }

  async generateBarcode(text) {
    if (!text) return null;
    try {
      return await bwipjs.toBuffer({
        bcid: "code128",
        text: text.replace(/[\s\n]+/g, ""),
        scale: 4,
        height: 15,
        includetext: true,
        textxalign: "center",
        textsize: 13,
        paddingwidth: 20,
        paddingheight: 10,
      });
    } catch (err) {
      console.error(`Barcode error for ${text}: ${err.message}`);
      return null;
    }
  }

  async downloadImage(url) {
    try {
      const response = await axios({
        url,
        responseType: "arraybuffer",
        timeout: 15000,
      });
      return response.data;
    } catch (err) {
      console.error(`Image download error: ${url}`);
      return null;
    }
  }

  async scrapePage(page) {
    try {
      console.log(`\nProcessing Page ${page} of ${this.totalPages}`);
      const url = `https://menhal.sa/products?page=${page}`;
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      const products = [];
      const items = $(".product-item");

      for (let i = 0; i < items.length; i++) {
        const el = items[i];
        console.log(
          `=> Product ${i + 1}/${items.length} | Page ${page}/${this.totalPages}`,
        );

        const productUrl =
          "https://menhal.sa" +
          $(el).find('a[href^="/products/"]').first().attr("href");
        const productResponse = await axios.get(productUrl);
        const product$ = cheerio.load(productResponse.data);

        products.push({
          name: $(el).find(".product-title span").text().trim(),
          price: $(el).find(".product-price span").text().trim(),
          barcode: product$(".div-product-sku").text().trim(),
          imageUrl: $(el).find('img[id^="product-card-img"]').attr("src"),
          url: productUrl,
        });

        await this.sleep(500);
      }
      return products;
    } catch (err) {
      console.error(`Error on page ${page}: ${err.message}`);
      return [];
    }
  }

  async processProduct(product) {
    const row = this.worksheet.addRow({
      name: product.name,
      price: product.price,
      url: product.url,
    });

    const [productImage, barcodeImage] = await Promise.all([
      this.downloadImage(product.imageUrl),
      this.generateBarcode(product.barcode),
    ]);

    const rowHeight = 120;
    row.height = rowHeight;

    if (productImage) {
      const imageId = this.workbook.addImage({
        buffer: productImage,
        extension: "jpeg",
      });

      this.worksheet.addImage(imageId, {
        tl: { col: 0, row: this.rowNumber - 1 },
        ext: { width: 140, height: rowHeight - 5 },
        editAs: "oneCell",
      });
    }

    if (barcodeImage) {
      const barcodeId = this.workbook.addImage({
        buffer: barcodeImage,
        extension: "png",
      });

      this.worksheet.addImage(barcodeId, {
        tl: { col: 1, row: this.rowNumber - 1 },
        ext: { width: 220, height: rowHeight - 5 },
        editAs: "oneCell",
      });
    }

    row.font = { size: 11 };
    row.alignment = { vertical: "middle", horizontal: "right" };
    row.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: this.rowNumber % 2 === 0 ? "F5F5F5" : "FFFFFF" },
    };

    this.rowNumber++;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async run() {
    try {
      console.log("=== Starting Product Scraper ===");
      console.log(`Total Pages to Process: ${this.totalPages}`);

      for (let page = 1; page <= this.totalPages; page++) {
        const products = await this.scrapePage(page);
        for (const product of products) {
          await this.processProduct(product);
        }

        if (page % 5 === 0) {
          console.log(`\nSaving checkpoint at page ${page}...`);
          await this.workbook.xlsx.writeFile(`products_page${page}.xlsx`);
        }
      }

      console.log("\nGenerating final file...");
      await this.workbook.xlsx.writeFile("products_complete.xlsx");
      console.log("✓ Scraping completed successfully");
    } catch (err) {
      console.error("× Process failed:", err.message);
    }
  }
}

new ProductScraper().run();
