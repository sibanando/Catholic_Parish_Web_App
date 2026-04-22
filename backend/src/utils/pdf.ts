import crypto from 'crypto';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs/promises';

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function renderTemplate(template: string, data: Record<string, string>): string {
  return Object.entries(data).reduce(
    (html, [key, value]) => html.replace(new RegExp(`{{${key}}}`, 'g'), value || ''),
    template
  );
}

export async function generateQRCode(text: string): Promise<string> {
  return QRCode.toDataURL(text);
}

export async function generatePDF(html: string, outputPath: string): Promise<void> {
  // Dynamic import to handle environments where puppeteer may not be installed
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({ path: outputPath, format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
    await browser.close();
  } catch {
    // Fallback: write HTML file if puppeteer not available
    const htmlPath = outputPath.replace('.pdf', '.html');
    await fs.writeFile(htmlPath, html, 'utf-8');
    throw new Error(`PDF generation requires puppeteer. HTML saved to ${htmlPath}`);
  }
}

export async function ensureCertDir(): Promise<string> {
  const dir = path.join(process.cwd(), 'certificates');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
