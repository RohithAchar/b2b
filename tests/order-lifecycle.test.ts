import { describe, expect, it } from "vitest";
import {
  ORDER_STATUS_TRANSITIONS,
  ORDER_STATUSES,
  availableBuyerActions,
  availableSupplierActions,
  canBuyerClaimPayment,
  canTransitionOrderStatus,
  canTransitionPaymentStatus,
  orderAtOrBeyond,
  parseOrderStatus,
  parsePaymentStatus,
  type OrderStatus,
} from "../lib/orders/lifecycle";
import {
  formatDeliveryLine,
  parseDeliverySnapshot,
  toDeliverySnapshot,
} from "../lib/orders/delivery";

describe("order status machine", () => {
  it("allows the happy path new -> quoted/confirmed -> processing -> shipped -> delivered", () => {
    expect(canTransitionOrderStatus("new", "confirmed")).toBe(true);
    expect(canTransitionOrderStatus("new", "quoted")).toBe(true);
    expect(canTransitionOrderStatus("quoted", "confirmed")).toBe(true);
    expect(canTransitionOrderStatus("confirmed", "processing")).toBe(true);
    expect(canTransitionOrderStatus("processing", "shipped")).toBe(true);
    expect(canTransitionOrderStatus("shipped", "delivered")).toBe(true);
  });

  it("allows cancellation from any live stage", () => {
    expect(canTransitionOrderStatus("new", "cancelled")).toBe(true);
    expect(canTransitionOrderStatus("quoted", "cancelled")).toBe(true);
    expect(canTransitionOrderStatus("confirmed", "cancelled")).toBe(true);
    expect(canTransitionOrderStatus("processing", "cancelled")).toBe(true);
  });

  it("returns a quote to review after the buyer rejects it", () => {
    expect(canTransitionOrderStatus("quoted", "new")).toBe(true);
  });

  it("blocks backwards or terminal transitions", () => {
    expect(canTransitionOrderStatus("delivered", "new")).toBe(false);
    expect(canTransitionOrderStatus("delivered", "shipped")).toBe(false);
    expect(canTransitionOrderStatus("cancelled", "confirmed")).toBe(false);
    expect(canTransitionOrderStatus("shipped", "processing")).toBe(false);
    expect(canTransitionOrderStatus("processing", "confirmed")).toBe(false);
    expect(canTransitionOrderStatus("new", "delivered")).toBe(false);
  });

  it("every status has a transition entry", () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_STATUS_TRANSITIONS[status]).toBeDefined();
    }
  });
});

describe("payment status machine", () => {
  it("allows not_requested -> pending -> paid and direct not_requested -> paid", () => {
    expect(canTransitionPaymentStatus("not_requested", "pending")).toBe(true);
    expect(canTransitionPaymentStatus("pending", "paid")).toBe(true);
    expect(canTransitionPaymentStatus("not_requested", "paid")).toBe(true);
  });

  it("lets the buyer claim payment and the supplier resolve it", () => {
    expect(canTransitionPaymentStatus("not_requested", "claimed")).toBe(true);
    expect(canTransitionPaymentStatus("pending", "claimed")).toBe(true);
    expect(canTransitionPaymentStatus("claimed", "paid")).toBe(true);
    // Not received: the claim is sent back so the buyer can resubmit.
    expect(canTransitionPaymentStatus("claimed", "pending")).toBe(true);
    expect(canTransitionPaymentStatus("claimed", "not_requested")).toBe(false);
  });

  it("never moves a settled or untouched payment backwards", () => {
    expect(canTransitionPaymentStatus("paid", "pending")).toBe(false);
    expect(canTransitionPaymentStatus("paid", "claimed")).toBe(false);
    expect(canTransitionPaymentStatus("paid", "not_requested")).toBe(false);
    expect(canTransitionPaymentStatus("pending", "not_requested")).toBe(false);
  });
});

describe("available supplier actions", () => {
  it("offers review, rejection and quotation while awaiting review", () => {
    expect(availableSupplierActions("new")).toContain("accept");
    expect(availableSupplierActions("new")).toContain("reject");
    expect(availableSupplierActions("new")).toContain("create_quotation");
    expect(availableSupplierActions("quoted")).toContain("accept");
  });

  it("offers payment confirmation on any live order", () => {
    for (const status of ["new", "quoted", "confirmed", "processing", "shipped"] as OrderStatus[]) {
      expect(availableSupplierActions(status)).toContain("mark_paid");
      expect(availableSupplierActions(status)).toContain("mark_payment_not_received");
    }
    expect(availableSupplierActions("delivered")).not.toContain("mark_paid");
    expect(availableSupplierActions("cancelled")).not.toContain("mark_paid");
  });

  it("follows the fulfilment lifecycle", () => {
    expect(availableSupplierActions("confirmed")).toContain("start_processing");
    expect(availableSupplierActions("processing")).toContain("record_shipment");
    expect(availableSupplierActions("shipped")).toContain("mark_delivered");
    expect(availableSupplierActions("shipped")).not.toContain("start_processing");
  });

  it("offers nothing on terminal orders", () => {
    expect(availableSupplierActions("cancelled")).toEqual([]);
    expect(availableSupplierActions("delivered")).toEqual([]);
  });
});

describe("available buyer actions", () => {
  it("only offers quote responses while a quote is pending", () => {
    expect(availableBuyerActions("quoted")).toEqual(["accept_quotation", "reject_quotation"]);
    expect(availableBuyerActions("new")).toEqual([]);
    expect(availableBuyerActions("confirmed")).toEqual([]);
    expect(availableBuyerActions("cancelled")).toEqual([]);
  });

  it("lets the buyer claim payment only while money is outstanding", () => {
    expect(canBuyerClaimPayment("confirmed", "pending")).toBe(true);
    expect(canBuyerClaimPayment("confirmed", "not_requested")).toBe(true);
    expect(canBuyerClaimPayment("quoted", "pending")).toBe(true);
    expect(canBuyerClaimPayment("shipped", "pending")).toBe(true);
    // Not before a quote/confirmation, and already submitted/paid is closed.
    expect(canBuyerClaimPayment("new", "pending")).toBe(false);
    expect(canBuyerClaimPayment("confirmed", "claimed")).toBe(false);
    expect(canBuyerClaimPayment("confirmed", "paid")).toBe(false);
    expect(canBuyerClaimPayment("cancelled", "pending")).toBe(false);
    expect(canBuyerClaimPayment("delivered", "pending")).toBe(false);
  });
});

describe("order progress ordering", () => {
  it("treats each step as done once reached or passed", () => {
    expect(orderAtOrBeyond("processing", "processing")).toBe(true);
    expect(orderAtOrBeyond("shipped", "processing")).toBe(true);
    expect(orderAtOrBeyond("delivered", "shipped")).toBe(true);
    expect(orderAtOrBeyond("new", "new")).toBe(true);
  });

  it("keeps later steps open while the order is behind them", () => {
    expect(orderAtOrBeyond("confirmed", "processing")).toBe(false);
    expect(orderAtOrBeyond("quoted", "shipped")).toBe(false);
    expect(orderAtOrBeyond("processing", "shipped")).toBe(false);
  });

  it("is past nothing once cancelled", () => {
    expect(orderAtOrBeyond("cancelled", "new")).toBe(false);
    expect(orderAtOrBeyond("cancelled", "delivered")).toBe(false);
  });
});

describe("status parsing", () => {
  it("accepts known values and rejects junk", () => {
    expect(parseOrderStatus("shipped")).toBe("shipped");
    expect(parseOrderStatus("SHIPPED")).toBeNull();
    expect(parseOrderStatus(undefined)).toBeNull();
    expect(parsePaymentStatus("paid")).toBe("paid");
    expect(parsePaymentStatus("claimed")).toBe("claimed");
    expect(parsePaymentStatus("refunded")).toBeNull();
  });
});

describe("delivery snapshot validation", () => {
  const valid = {
    fullName: "Test Buyer",
    phone: "9876543210",
    line1: "12 MG Road",
    line2: "Sector 14",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    instructions: "Call before delivery",
  };

  it("accepts a valid address and normalizes the phone", () => {
    const result = parseDeliverySnapshot({ ...valid, phone: "+91 98765 43210" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.phone).toBe("9876543210");
    }
  });

  it("nulls blank optional fields", () => {
    const result = parseDeliverySnapshot({ ...valid, line2: "", instructions: "" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.line2).toBeNull();
      expect(result.value.instructions).toBeNull();
    }
  });

  it("rejects invalid phone numbers", () => {
    const result = parseDeliverySnapshot({ ...valid, phone: "1234567890" });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid PIN codes", () => {
    expect(parseDeliverySnapshot({ ...valid, pincode: "012345" }).ok).toBe(false);
    expect(parseDeliverySnapshot({ ...valid, pincode: "5600012" }).ok).toBe(false);
    expect(parseDeliverySnapshot({ ...valid, pincode: "5600a1" }).ok).toBe(false);
  });

  it("rejects missing or too-short required fields", () => {
    expect(parseDeliverySnapshot({ ...valid, fullName: "" }).ok).toBe(false);
    expect(parseDeliverySnapshot({ ...valid, line1: "" }).ok).toBe(false);
    expect(parseDeliverySnapshot({ ...valid, city: "" }).ok).toBe(false);
    expect(parseDeliverySnapshot({ ...valid, state: "" }).ok).toBe(false);
    expect(parseDeliverySnapshot(undefined).ok).toBe(false);
  });

  it("renders a single address line for compact displays", () => {
    const result = parseDeliverySnapshot(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(formatDeliveryLine(result.value)).toBe(
        "12 MG Road, Sector 14, Bengaluru, Karnataka, 560001",
      );
    }
  });

  it("maps a stored address record into a snapshot", () => {
    const snapshot = toDeliverySnapshot({
      id: "a1",
      fullName: "Test Buyer",
      phone: "9876543210",
      line1: "12 MG Road",
      line2: null,
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      instructions: null,
      isDefault: true,
    });
    expect(snapshot.line2).toBeNull();
    expect(formatDeliveryLine(snapshot)).toBe("12 MG Road, Bengaluru, Karnataka, 560001");
  });
});
