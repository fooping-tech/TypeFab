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
  limits: {
    maxWidthMm: 300,
    maxHeightMm: 200,
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
  materials: [
    {
      id: "mdf",
      name: "MDF",
      // material fee per cm² of bounding area, processing fee per mm of cut,
      // cutting speed for the time estimate (mm/min), pierce time per path (s)
      thicknesses: [
        { mm: 2.5, materialPerCm2: 1.2, cutPerMm: 0.25, speedMmPerMin: 900, pierceSeconds: 0.5 },
        { mm: 3, materialPerCm2: 1.4, cutPerMm: 0.3, speedMmPerMin: 700, pierceSeconds: 0.6 },
        { mm: 5.5, materialPerCm2: 2.0, cutPerMm: 0.45, speedMmPerMin: 350, pierceSeconds: 1 },
      ],
    },
    {
      id: "acrylic",
      name: "アクリル（キャスト・透明）",
      thicknesses: [
        { mm: 2, materialPerCm2: 3.0, cutPerMm: 0.35, speedMmPerMin: 600, pierceSeconds: 0.6 },
        { mm: 3, materialPerCm2: 3.6, cutPerMm: 0.45, speedMmPerMin: 400, pierceSeconds: 0.8 },
        { mm: 5, materialPerCm2: 5.2, cutPerMm: 0.7, speedMmPerMin: 220, pierceSeconds: 1.2 },
      ],
    },
    {
      id: "other",
      name: "その他（要相談）",
      inquiryOnly: true,
      thicknesses: [],
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
    const { maxWidthMm, maxHeightMm, minSizeMm } = catalog.limits;
    const fits =
      (widthMm <= maxWidthMm && heightMm <= maxHeightMm) ||
      (heightMm <= maxWidthMm && widthMm <= maxHeightMm);
    if (!fits) errors.push(`サイズが大きすぎます（最大 ${maxWidthMm} × ${maxHeightMm} mm）。`);
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
    limits: catalog.limits,
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
