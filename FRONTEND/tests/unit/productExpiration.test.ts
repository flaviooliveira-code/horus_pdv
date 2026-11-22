import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SHELF_LIFE_DAYS,
  addDaysToIsoDate,
  computeEffectiveExpirationDate,
  evaluateProductExpiration,
  formatIsoDateBr,
} from "../../src/utils/productExpiration.ts";

test("addDaysToIsoDate computes exact calendar dates across month boundaries", () => {
  assert.equal(addDaysToIsoDate("2026-11-10", DEFAULT_SHELF_LIFE_DAYS), "2026-12-10");
  assert.equal(addDaysToIsoDate("2024-02-01", 30), "2024-03-02");
  assert.equal(addDaysToIsoDate("2026-01-31", 30), "2026-03-02");
  assert.equal(addDaysToIsoDate("invalid", 30), "");
});

test("computeEffectiveExpirationDate resolves DAYS_FROM_MANUFACTURE and FIXED_DATE", () => {
  assert.equal(
    computeEffectiveExpirationDate({
      expirationMode: "DAYS_FROM_MANUFACTURE",
      manufactureDate: "2026-11-01",
      shelfLifeDays: null,
    }),
    "2026-12-01",
  );

  assert.equal(
    computeEffectiveExpirationDate({
      expirationMode: "DAYS_FROM_MANUFACTURE",
      manufactureDate: "2026-11-01",
      shelfLifeDays: 15,
    }),
    "2026-11-16",
  );

  assert.equal(
    computeEffectiveExpirationDate({
      expirationMode: "FIXED_DATE",
      expirationDate: "2027-01-20",
    }),
    "2027-01-20",
  );
});

test("evaluateProductExpiration classifies NONE, EXPIRED, EXPIRING_SOON and OK accurately", () => {
  const ref = "2026-11-22";

  assert.equal(evaluateProductExpiration("", ref).status, "NONE");
  assert.equal(evaluateProductExpiration("2026-99-99", ref).status, "NONE");

  const expiredTwoDays = evaluateProductExpiration("2026-11-20", ref);
  assert.equal(expiredTwoDays.status, "EXPIRED");
  assert.equal(expiredTwoDays.daysUntilExpiration, -2);
  assert.equal(expiredTwoDays.label, "Vencido há 2 dias");

  const expiresToday = evaluateProductExpiration("2026-11-22", ref);
  assert.equal(expiresToday.status, "EXPIRING_SOON");
  assert.equal(expiresToday.daysUntilExpiration, 0);
  assert.equal(expiresToday.label, "Vence hoje");

  const expiresTomorrow = evaluateProductExpiration("2026-11-23", ref);
  assert.equal(expiresTomorrow.status, "EXPIRING_SOON");
  assert.equal(expiresTomorrow.label, "Vence amanhã");

  const expiresBoundary = evaluateProductExpiration("2026-11-29", ref);
  assert.equal(expiresBoundary.status, "EXPIRING_SOON");
  assert.equal(expiresBoundary.daysUntilExpiration, 7);
  assert.equal(expiresBoundary.label, "Vence em 7 dias");

  const okItem = evaluateProductExpiration("2026-11-30", ref);
  assert.equal(okItem.status, "OK");
  assert.equal(okItem.daysUntilExpiration, 8);
});

test("formatIsoDateBr formats valid ISO dates as dd/MM/yyyy", () => {
  assert.equal(formatIsoDateBr("2026-11-22"), "22/11/2026");
  assert.equal(formatIsoDateBr("2026-02-30"), "");
});
