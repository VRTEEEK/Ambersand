import path from "path";
import fs from "fs/promises";
import Handlebars from "handlebars";

const TPL_DIR = path.join(process.cwd(), "server", "email", "templates");

const cache: Record<string, Handlebars.TemplateDelegate> = {};

export async function renderTemplate(name: string, data: Record<string, any> = {}) {
  const key = name.replace(/\.hbs$/i, "");
  if (!cache[key]) {
    const filePath = path.join(TPL_DIR, `${key}.hbs`);
    const src = await fs.readFile(filePath, "utf8");
    cache[key] = Handlebars.compile(src);
  }
  return cache[key](data);
}