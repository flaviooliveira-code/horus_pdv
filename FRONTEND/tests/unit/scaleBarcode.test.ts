import assert from "node:assert/strict";
import test from "node:test";
import {
  formatQuantityPtBr,
  isValidEan13CheckDigit,
  parseScaleBarcode,
  roundQuantity,
  type ScaleProductMatchInput,
} from "../../src/utils/scaleBarcode.ts";

function buildEan13(twelveDigits: string): string {
  assert.equal(twelveDigits.length, 12);
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const digit = Number(twelveDigits[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return `${twelveDigits}${check}`;
}

const sampleProducts: ScaleProductMatchInput[] = [
  { id: "1", code: "123", name: "Queijo Mussarela", salePrice: 49.0, stock: 25, unitType: "KG" },
  { id: "2", code: "0456", name: "Presunto Parma", salePrice: 30.0, stock: 10, unitType: "KG" },
  { id: "3", code: "123456", name: "Picanha Bovina", salePrice: 79.8, stock: 12, unitType: "KG" },
  { id: "4", code: "999", name: "Item Sem Preço", salePrice: 0, stock: 5, unitType: "KG" },
];

test("isValidEan13CheckDigit validates mod-10 digits and rejects invalid barcodes", () => {
  const valid = buildEan13("200123002450");
  assert.equal(isValidEan13CheckDigit(valid), true);

  const invalid = `${valid.slice(0, 12)}${(Number(valid[12]) + 1) % 10}`;
  assert.equal(isValidEan13CheckDigit(invalid), false);
  assert.equal(isValidEan13CheckDigit("200123"), false);
  assert.equal(isValidEan13CheckDigit("200123002450A"), false);
});

test("parseScaleBarcode decodes 5-digit price-encoded labels with zero-trimmed codes", () => {
  const barcode = buildEan13("200123002450");
  const match = parseScaleBarcode(barcode, sampleProducts, "price");

  assert.ok(match);
  assert.equal(match.layout, "5x6");
  assert.equal(match.product.id, "1");
  assert.equal(match.totalValue, 24.5);
  assert.equal(match.quantity, 0.5);
});

test("parseScaleBarcode supports 4-digit (20...) and 6-digit layouts", () => {
  const barcode4 = buildEan13("200456001500");
  const match4 = parseScaleBarcode(barcode4, sampleProducts, "price");
  assert.ok(match4);
  assert.equal(match4.layout, "4x6");
  assert.equal(match4.product.id, "2");
  assert.equal(match4.quantity, 0.5);
  assert.equal(match4.totalValue, 15);

  const barcode6 = buildEan13("212345603990");
  const match6 = parseScaleBarcode(barcode6, sampleProducts, "price");
  assert.ok(match6);
  assert.equal(match6.layout, "6x5");
  assert.equal(match6.product.id, "3");
  assert.equal(match6.totalValue, 39.9);
  assert.equal(match6.quantity, 0.5);
});

test("parseScaleBarcode decodes weight-encoded labels", () => {
  const barcode = buildEan13("200123000450");
  const match = parseScaleBarcode(barcode, sampleProducts, "weight");

  assert.ok(match);
  assert.equal(match.mode, "weight");
  assert.equal(match.quantity, 0.45);
  assert.equal(match.totalValue, 22.05);
});

test("parseScaleBarcode returns null for non-prefix-2, invalid check digit, unknown code, or zero price", () => {
  assert.equal(parseScaleBarcode(buildEan13("789123002450"), sampleProducts), null);
  assert.equal(parseScaleBarcode("2001230024500", sampleProducts), null);
  assert.equal(parseScaleBarcode(buildEan13("200888002450"), sampleProducts), null);
  assert.equal(parseScaleBarcode(buildEan13("200999002450"), sampleProducts), null);
});

test("roundQuantity and formatQuantityPtBr avoid float drift and format integers/decimals cleanly", () => {
  assert.equal(roundQuantity(0.45 + 0.32), 0.77);
  assert.equal(formatQuantityPtBr(3), "3");
  assert.equal(formatQuantityPtBr(0.45), "0,45");
  assert.equal(formatQuantityPtBr(0.455), "0,455");
  assert.equal(formatQuantityPtBr(1.2), "1,2");
});
