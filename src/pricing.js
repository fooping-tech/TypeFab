// Order pricing and catalogue for the laser-cut ordering flow (issue #1).
// Pure module shared by the order page (estimate) and the Cloudflare Worker
// (authoritative price). Amounts are integer yen. All values below are
// provisional placeholders (仮設定) until real fabrication costs are known.
export const DELIVERY = {
  NORMAL: { leadTimeDays: 7, multiplier: 1, label: "通常" },
  EXPRESS: { leadTimeDays: 3, multiplier: 2, label: "特急" },
};
export const CATALOG = {
  currency: "JPY",
  baseFee: 500, // per order
  bulkThreshold: 10, // quantity at or above this needs an inquiry first
  // Orderable design size: a 長形3号 envelope (120 × 235 mm, the largest
  // 定形郵便 size) minus a 10 mm margin on every side. Either orientation is
  // accepted (215 × 100 or 100 × 215). Change `sheet` to use another envelope;
  // `limits` and `sizeNote` below must match it.
  sheet: { name: "長形3号封筒", widthMm: 120, heightMm: 235, marginMm: 10 },
  limits: {
    maxWidthMm: 215,
    maxHeightMm: 100,
    sizeNote: "長形3号封筒（120 × 235 mm）から周囲 10 mm のマージンを除いた範囲",
    minSizeMm: 5,
    maxSvgBytes: 2 * 1024 * 1024,
    maxQuantity: 999,
  },
  delivery: DELIVERY,
  shipping: [
    // First rule whose size limits hold applies. Shipping is never doubled.
    { id: "compact", label: "コンパクト便", maxWidthMm: 200, maxHeightMm: 150, maxQuantity: 3, price: 750 },
    { id: "parcel", label: "宅配便", price: 1100 },
  ],
  // The only material offered is black kraft paper. The quote code still
  // supports several materials/thicknesses and `inquiryOnly` entries, so
  // adding one here is enough to offer it.
  materials: [
    {
      id: "kraft-black",
      name: "黒クラフトペーパー",
      // material fee per cm² of bounding area, processing fee per mm of cut,
      // cutting speed for the time estimate (mm/min), pierce time per path (s).
      // Placeholder values; the sheet is about 0.3 mm thick.
      thicknesses: [{ mm: 0.3, materialPerCm2: 0.3, cutPerMm: 0.1, speedMmPerMin: 1500, pierceSeconds: 0.2 }],
    },
  ],
};
export const ORDER_STATUSES = [
  "NEW",
  "PAYMENT_PENDING",
  "PAID",
  "PROCESSING",
  "READY",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
];
// Allowed manual transitions in the admin screen.
export const TRANSITIONS = {
  PAID: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY", "CANCELLED"],
  READY: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["COMPLETED"],
  PAYMENT_PENDING: ["CANCELLED"],
  NEW: ["CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};
export function material(catalog, id) {
  return catalog.materials.find((m) => m.id === id) ?? null;
}
export function thickness(catalog, materialId, mm) {
  return (
    material(catalog, materialId)?.thicknesses.find(
      (t) => Math.abs(t.mm - Number(mm)) < 1e-9,
    ) ?? null
  );
}
export function shippingRule(catalog, { widthMm, heightMm, quantity }) {
  const fits = (r) =>
    (r.maxWidthMm === undefined ||
      (widthMm <= r.maxWidthMm && heightMm <= r.maxHeightMm) ||
      (heightMm <= r.maxWidthMm && widthMm <= r.maxHeightMm)) &&
    (r.maxQuantity === undefined || quantity <= r.maxQuantity);
  return catalog.shipping.find(fits) ?? catalog.shipping.at(-1);
}
const yen = (n) => Math.round(n);
// Validates the order options and returns the price breakdown.
//   fabricationPrice = baseFee + materialFee + processingFee + quantityFee
//   processingPrice  = fabricationPrice × delivery multiplier (EXPRESS ×2)
//   totalPrice       = processingPrice + shippingPrice (never multiplied)
// `inquiryRequired` is set instead of a price for bulk quantities or
// inquiry-only materials; the Worker refuses checkout in that case.
export function quote(input, catalog = CATALOG) {
  const errors = [];
  const widthMm = Number(input.widthMm),
    heightMm = Number(input.heightMm),
    quantity = Number(input.quantity),
    cutLengthMm = Number(input.cutLengthMm ?? 0),
    pathCount = Number(input.pathCount ?? 0),
    deliveryType = String(input.deliveryType ?? "NORMAL");
  const mat = material(catalog, input.material);
  if (!mat) errors.push("材料を選んでください。");
  const th = mat && !mat.inquiryOnly ? thickness(catalog, mat.id, input.thicknessMm) : null;
  if (mat && !mat.inquiryOnly && !th) errors.push("厚さを選んでください。");
  if (!Number.isInteger(quantity) || quantity < 1) errors.push("数量は1以上の整数です。");
  else if (quantity > catalog.limits.maxQuantity) errors.push(`数量は${catalog.limits.maxQuantity}以下です。`);
  if (!catalog.delivery[deliveryType]) errors.push("納期の種類が不正です。");
  if (!(widthMm > 0 && heightMm > 0)) errors.push("SVGの実寸（mm）が必要です。");
  else {
    const { maxWidthMm, maxHeightMm, minSizeMm, sizeNote } = catalog.limits;
    const fits =
      (widthMm <= maxWidthMm && heightMm <= maxHeightMm) ||
      (heightMm <= maxWidthMm && widthMm <= maxHeightMm);
    if (!fits) errors.push(`サイズが大きすぎます（最大 ${maxWidthMm} × ${maxHeightMm} mm${sizeNote ? `、${sizeNote}` : ""}）。`);
    if (widthMm < minSizeMm || heightMm < minSizeMm) errors.push(`サイズが小さすぎます（最小 ${minSizeMm} mm）。`);
  }
  if (!(cutLengthMm >= 0) || !(pathCount >= 0)) errors.push("カット長・パス数が不正です。");
  if (errors.length) return { ok: false, errors };
  const inquiry = [];
  if (mat.inquiryOnly) inquiry.push("この材料は事前にお問い合わせください。");
  if (quantity >= catalog.bulkThreshold)
    inquiry.push(
      `${catalog.bulkThreshold}個以上の大量注文は、材料在庫・加工時間・納期を確認する必要があるため、事前にお問い合わせください。`,
    );
  const delivery = catalog.delivery[deliveryType];
  const areaCm2 = (widthMm * heightMm) / 100;
  const materialFee = th ? yen(Math.max(100, areaCm2 * th.materialPerCm2)) : 0;
  const processingFee = th ? yen(cutLengthMm * th.cutPerMm) : 0;
  const unitPrice = materialFee + processingFee;
  const quantityFee = unitPrice * (quantity - 1);
  const fabricationPrice = catalog.baseFee + materialFee + processingFee + quantityFee;
  const processingPrice = fabricationPrice * delivery.multiplier;
  const ship = shippingRule(catalog, { widthMm, heightMm, quantity });
  const shippingPrice = ship.price;
  const minutesPerUnit = th
    ? cutLengthMm / th.speedMmPerMin + (pathCount * th.pierceSeconds) / 60
    : 0;
  return {
    ok: true,
    errors: [],
    inquiryRequired: inquiry.length > 0,
    inquiryReasons: inquiry,
    currency: catalog.currency,
    material: mat.id,
    materialName: mat.name,
    thicknessMm: th?.mm ?? null,
    quantity,
    deliveryType,
    leadTimeDays: delivery.leadTimeDays,
    widthMm,
    heightMm,
    cutLengthMm,
    pathCount,
    baseFee: catalog.baseFee,
    materialFee,
    processingFee,
    quantityFee,
    fabricationPrice,
    deliveryMultiplier: delivery.multiplier,
    basePrice: catalog.baseFee,
    processingPrice: inquiry.length ? null : processingPrice,
    shippingPrice: inquiry.length ? null : shippingPrice,
    shippingLabel: ship.label,
    totalPrice: inquiry.length ? null : processingPrice + shippingPrice,
    estimatedProcessingMinutes: Number((minutesPerUnit * quantity).toFixed(1)),
  };
}
// Ship-by date: paid date + lead time (calendar days; holidays ignored in MVP).
export function shipByDate(paidAt, deliveryType, catalog = CATALOG) {
  const d = new Date(paidAt);
  d.setUTCDate(d.getUTCDate() + catalog.delivery[deliveryType].leadTimeDays);
  return d.toISOString();
}
// Public, serialisable view of the catalogue for the order page.
export function publicCatalog(catalog = CATALOG) {
  return {
    currency: catalog.currency,
    baseFee: catalog.baseFee,
    bulkThreshold: catalog.bulkThreshold,
    sheet: catalog.sheet ? { ...catalog.sheet } : null,
    limits: { ...catalog.limits },
    delivery: Object.fromEntries(
      Object.entries(catalog.delivery).map(([k, v]) => [k, { ...v }]),
    ),
    shipping: catalog.shipping.map((s) => ({ ...s })),
    materials: catalog.materials.map((m) => ({
      id: m.id,
      name: m.name,
      inquiryOnly: !!m.inquiryOnly,
      thicknesses: m.thicknesses.map((t) => ({ ...t })),
    })),
  };
}
