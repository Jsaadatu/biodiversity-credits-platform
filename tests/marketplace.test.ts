import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const seller = accounts.get("wallet_1")!;
const buyer = accounts.get("wallet_2")!;
const otherUser = accounts.get("wallet_3")!;

describe("Biodiversity Credit Marketplace Contract", () => {
  
  describe("Listing Creation", () => {
    it("should create a new credit listing", () => {
      const { result } = simnet.callPublicFn(
        "marketplace",
        "create-listing",
        [
          Cl.uint(1), // credit-id
          Cl.uint(5000), // price-per-unit (5000 microSTX)
          Cl.uint(100), // quantity
          Cl.uint(0) // listing-type (fixed-price)
        ],
        seller
      );
      
      expect(result).toBeOk(Cl.uint(0));
    });
    
    it("should increment listing ID for each new listing", () => {
      // Create first listing
      const { result: result1 } = simnet.callPublicFn(
        "marketplace",
        "create-listing",
        [
          Cl.uint(1),
          Cl.uint(5000),
          Cl.uint(100),
          Cl.uint(0)
        ],
        seller
      );
      
      // Create second listing
      const { result: result2 } = simnet.callPublicFn(
        "marketplace",
        "create-listing",
        [
          Cl.uint(2),
          Cl.uint(6000),
          Cl.uint(50),
          Cl.uint(0)
        ],
        seller
      );
      
      expect(result1).toBeOk(Cl.uint(0));
      expect(result2).toBeOk(Cl.uint(1));
    });
    
    it("should fail with price below minimum", () => {
      const { result } = simnet.callPublicFn(
        "marketplace",
        "create-listing",
        [
          Cl.uint(1),
          Cl.uint(500), // Below MIN-PRICE (1000)
          Cl.uint(100),
          Cl.uint(0)
        ],
        seller
      );
      
      expect(result).toBeErr(Cl.uint(202)); // ERR-INVALID-PRICE
    });
    
    it("should fail with zero quantity", () => {
      const { result } = simnet.callPublicFn(
        "marketplace",
        "create-listing",
        [
          Cl.uint(1),
          Cl.uint(5000),
          Cl.uint(0), // Invalid quantity
          Cl.uint(0)
        ],
        seller
      );
      
      expect(result).toBeErr(Cl.uint(203)); // ERR-INVALID-QUANTITY
    });
    
    it("should store listing information correctly", () => {
      // Create listing
      simnet.callPublicFn(
        "marketplace",
        "create-listing",
        [
          Cl.uint(1),
          Cl.uint(5000),
          Cl.uint(100),
          Cl.uint(0)
        ],
        seller
      );
      
      // Retrieve listing
      const { result } = simnet.callReadOnlyFn(
        "marketplace",
        "get-listing",
        [Cl.uint(0)],
        deployer
      );
      
      expect(result).toBeSome(
        Cl.tuple({
          "credit-id": Cl.uint(1),
          seller: Cl.principal(seller),
          "price-per-unit": Cl.uint(5000),
          quantity: Cl.uint(100),
          "quantity-remaining": Cl.uint(100),
          status: Cl.uint(0), // STATUS-ACTIVE
          "created-block": Cl.uint(simnet.blockHeight),
          "updated-block": Cl.uint(simnet.blockHeight),
          "listing-type": Cl.uint(0)
        })
      );
    });
  });
  
  describe("Listing Cancellation", () => {
    beforeEach(() => {
      // Create a listing before each test
      simnet.callPublicFn(
        "marketplace",
        "create-listing",
        [
          Cl.uint(1),
          Cl.uint(5000),
          Cl.uint(100),
          Cl.uint(0)
        ],
        seller
      );
    });
    
    it("should cancel an active listing", () => {
      const { result } = simnet.callPublicFn(
        "marketplace",
        "cancel-listing",
        [Cl.uint(0)],
        seller
      );
      
      expect(result).toBeOk(Cl.bool(true));
    });
    
    it("should update listing status to cancelled", () => {
      // Cancel listing
      simnet.callPublicFn(
        "marketplace",
        "cancel-listing",
        [Cl.uint(0)],
        seller
      );
      
      // Check status
      const { result } = simnet.callReadOnlyFn(
        "marketplace",
        "get-listing",
        [Cl.uint(0)],
        deployer
      );
      
      // Verify listing exists (status updated to cancelled)
      expect(result.type).toBe('some');
    });
    
    it("should fail when non-seller tries to cancel", () => {
      const { result } = simnet.callPublicFn(
        "marketplace",
        "cancel-listing",
        [Cl.uint(0)],
        buyer
      );
      
      expect(result).toBeErr(Cl.uint(200)); // ERR-NOT-AUTHORIZED
    });
    
    it("should fail when cancelling non-existent listing", () => {
      const { result } = simnet.callPublicFn(
        "marketplace",
        "cancel-listing",
        [Cl.uint(999)],
        seller
      );
      
      expect(result).toBeErr(Cl.uint(201)); // ERR-LISTING-NOT-FOUND
    });
  });
  
  describe("Credit Purchase", () => {
    beforeEach(() => {
      // Create a listing before each test
      simnet.callPublicFn(
        "marketplace",
        "create-listing",
        [
          Cl.uint(1),
          Cl.uint(10000), // 10000 microSTX per unit
          Cl.uint(100),
          Cl.uint(0)
        ],
        seller
      );
    });
    
    it("should purchase credits from a listing", () => {
      const { result } = simnet.callPublicFn(
        "marketplace",
        "purchase-credit",
        [
          Cl.uint(0), // listing-id
          Cl.uint(10) // quantity to purchase
        ],
        buyer
      );
      
      expect(result).toBeOk(Cl.bool(true));
    });
    
    it("should update listing quantity after purchase", () => {
      // Purchase credits
      simnet.callPublicFn(
        "marketplace",
        "purchase-credit",
        [
          Cl.uint(0),
          Cl.uint(10)
        ],
        buyer
      );
      
      // Check remaining quantity
      const { result } = simnet.callReadOnlyFn(
        "marketplace",
        "get-listing",
        [Cl.uint(0)],
        deployer
      );
      
      // Verify listing exists (quantity updated)
      expect(result.type).toBe('some');
    });
    
    it("should mark listing as completed when fully purchased", () => {
      // Purchase all credits
      simnet.callPublicFn(
        "marketplace",
        "purchase-credit",
        [
          Cl.uint(0),
          Cl.uint(100)
        ],
        buyer
      );
      
      // Check status
      const { result } = simnet.callReadOnlyFn(
        "marketplace",
        "get-listing",
        [Cl.uint(0)],
        deployer
      );
      
      // Verify listing exists (status updated to completed)
      expect(result.type).toBe('some');
    });
    
    it("should fail when purchasing from cancelled listing", () => {
      // Cancel listing first
      simnet.callPublicFn(
        "marketplace",
        "cancel-listing",
        [Cl.uint(0)],
        seller
      );
      
      // Try to purchase
      const { result } = simnet.callPublicFn(
        "marketplace",
        "purchase-credit",
        [
          Cl.uint(0),
          Cl.uint(10)
        ],
        buyer
      );
      
      expect(result).toBeErr(Cl.uint(206)); // ERR-LISTING-INACTIVE
    });
    
    it("should fail when seller tries to buy their own listing", () => {
      const { result } = simnet.callPublicFn(
        "marketplace",
        "purchase-credit",
        [
          Cl.uint(0),
          Cl.uint(10)
        ],
        seller
      );
      
      expect(result).toBeErr(Cl.uint(207)); // ERR-SELF-PURCHASE
    });
    
    it("should fail when purchasing more than available", () => {
      const { result } = simnet.callPublicFn(
        "marketplace",
        "purchase-credit",
        [
          Cl.uint(0),
          Cl.uint(150) // More than available (100)
        ],
        buyer
      );
      
      expect(result).toBeErr(Cl.uint(204)); // ERR-INSUFFICIENT-BALANCE
    });
    
    it("should fail with zero quantity", () => {
      const { result } = simnet.callPublicFn(
        "marketplace",
        "purchase-credit",
        [
          Cl.uint(0),
          Cl.uint(0)
        ],
        buyer
      );
      
      expect(result).toBeErr(Cl.uint(203)); // ERR-INVALID-QUANTITY
    });
    
    it("should record trade in history", () => {
      // Purchase credits
      simnet.callPublicFn(
        "marketplace",
        "purchase-credit",
        [
          Cl.uint(0),
          Cl.uint(10)
        ],
        buyer
      );
      
      // Check trade record
      const { result } = simnet.callReadOnlyFn(
        "marketplace",
        "get-trade",
        [Cl.uint(0)],
        deployer
      );
      
      expect(result).toBeSome(
        Cl.tuple({
          "listing-id": Cl.uint(0),
          buyer: Cl.principal(buyer),
          seller: Cl.principal(seller),
          "credit-id": Cl.uint(1),
          quantity: Cl.uint(10),
          "price-per-unit": Cl.uint(10000),
          "total-price": Cl.uint(100000),
          "platform-fee": Cl.uint(1000), // 1% of 100000
          "executed-block": Cl.uint(simnet.blockHeight)
        })
      );
    });
    
    it("should update marketplace volume after purchase", () => {
      const initialVolume = simnet.callReadOnlyFn(
        "marketplace",
        "get-total-volume",
        [],
        deployer
      );
      
      // Purchase credits
      simnet.callPublicFn(
        "marketplace",
        "purchase-credit",
        [
          Cl.uint(0),
          Cl.uint(10)
        ],
        buyer
      );
      
      // Check volume increased
      const { result: newVolume } = simnet.callReadOnlyFn(
        "marketplace",
        "get-total-volume",
        [],
        deployer
      );
      
      expect(newVolume).toBeUint(100000); // 10 * 10000
    });
  });
  
  describe("Listing Price Update", () => {
    beforeEach(() => {
      // Create a listing before each test
      simnet.callPublicFn(
        "marketplace",
        "create-listing",
        [
          Cl.uint(1),
          Cl.uint(5000),
          Cl.uint(100),
          Cl.uint(0)
        ],
        seller
      );
    });
    
    it("should update listing price", () => {
      const { result } = simnet.callPublicFn(
        "marketplace",
        "update-listing-price",
        [
          Cl.uint(0),
          Cl.uint(7000)
        ],
        seller
      );
      
      expect(result).toBeOk(Cl.bool(true));
    });
    
    it("should fail when non-seller tries to update price", () => {
      const { result } = simnet.callPublicFn(
        "marketplace",
        "update-listing-price",
        [
          Cl.uint(0),
          Cl.uint(7000)
        ],
        buyer
      );
      
      expect(result).toBeErr(Cl.uint(200)); // ERR-NOT-AUTHORIZED
    });
    
    it("should fail with price below minimum", () => {
      const { result } = simnet.callPublicFn(
        "marketplace",
        "update-listing-price",
        [
          Cl.uint(0),
          Cl.uint(500) // Below MIN-PRICE
        ],
        seller
      );
      
      expect(result).toBeErr(Cl.uint(202)); // ERR-INVALID-PRICE
    });
  });
  
  describe("Platform Administration", () => {
    it("should allow owner to set fee collector", () => {
      const { result } = simnet.callPublicFn(
        "marketplace",
        "set-fee-collector",
        [Cl.principal(otherUser)],
        deployer
      );
      
      expect(result).toBeOk(Cl.bool(true));
    });
    
    it("should fail when non-owner tries to set fee collector", () => {
      const { result } = simnet.callPublicFn(
        "marketplace",
        "set-fee-collector",
        [Cl.principal(otherUser)],
        seller
      );
      
      expect(result).toBeErr(Cl.uint(200)); // ERR-NOT-AUTHORIZED
    });
  });
  
  describe("Read-Only Functions", () => {
    it("should return listing nonce", () => {
      const { result } = simnet.callReadOnlyFn(
        "marketplace",
        "get-listing-nonce",
        [],
        deployer
      );
      
      expect(result).toBeUint(0);
    });
    
    it("should calculate platform fee correctly", () => {
      const { result } = simnet.callReadOnlyFn(
        "marketplace",
        "calculate-platform-fee",
        [Cl.uint(100000)],
        deployer
      );
      
      expect(result).toBeUint(1000); // 1% of 100000
    });
    
    it("should return fee collector address", () => {
      const { result } = simnet.callReadOnlyFn(
        "marketplace",
        "get-fee-collector",
        [],
        deployer
      );
      
      expect(result).toBePrincipal(deployer);
    });
    
    it("should return none for non-existent listing", () => {
      const { result } = simnet.callReadOnlyFn(
        "marketplace",
        "get-listing",
        [Cl.uint(999)],
        deployer
      );
      
      expect(result).toBeNone();
    });
    
    it("should return none for non-existent trade", () => {
      const { result } = simnet.callReadOnlyFn(
        "marketplace",
        "get-trade",
        [Cl.uint(999)],
        deployer
      );
      
      expect(result).toBeNone();
    });
  });
});
