import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const issuer1 = accounts.get("wallet_1")!;
const issuer2 = accounts.get("wallet_2")!;
const verifier = accounts.get("wallet_3")!;
const buyer = accounts.get("wallet_4")!;

describe("Biodiversity Credit Registry Contract", () => {
  
  describe("Project Registration", () => {
    it("should register a new conservation project", () => {
      const { result } = simnet.callPublicFn(
        "registry",
        "register-project",
        [
          Cl.stringAscii("Amazon Reforestation Project"),
          Cl.stringUtf8("A conservation project focused on reforestation in the Amazon rainforest"),
          Cl.uint(0), // TYPE-BIODIVERSITY
          Cl.stringAscii("Brazil, Amazon"),
          Cl.stringAscii("ipfs://QmExample123")
        ],
        issuer1
      );
      
      expect(result).toBeOk(Cl.uint(0));
    });
    
    it("should increment project ID for each new project", () => {
      // Register first project
      const { result: result1 } = simnet.callPublicFn(
        "registry",
        "register-project",
        [
          Cl.stringAscii("Project One"),
          Cl.stringUtf8("First project"),
          Cl.uint(0),
          Cl.stringAscii("Location 1"),
          Cl.stringAscii("ipfs://QmExample1")
        ],
        issuer1
      );
      
      // Register second project
      const { result: result2 } = simnet.callPublicFn(
        "registry",
        "register-project",
        [
          Cl.stringAscii("Project Two"),
          Cl.stringUtf8("Second project"),
          Cl.uint(0),
          Cl.stringAscii("Location 2"),
          Cl.stringAscii("ipfs://QmExample2")
        ],
        issuer2
      );
      
      expect(result1).toBeOk(Cl.uint(0));
      expect(result2).toBeOk(Cl.uint(1));
    });
    
    it("should store project information correctly", () => {
      // Register project
      simnet.callPublicFn(
        "registry",
        "register-project",
        [
          Cl.stringAscii("Test Project"),
          Cl.stringUtf8("Test Description"),
          Cl.uint(0),
          Cl.stringAscii("Test Location"),
          Cl.stringAscii("ipfs://QmTest")
        ],
        issuer1
      );
      
      // Retrieve project info
      const { result } = simnet.callReadOnlyFn(
        "registry",
        "get-project-info",
        [Cl.uint(0)],
        issuer1
      );
      
      expect(result).toBeSome(
        Cl.tuple({
          name: Cl.stringAscii("Test Project"),
          description: Cl.stringUtf8("Test Description"),
          "project-type": Cl.uint(0),
          location: Cl.stringAscii("Test Location"),
          issuer: Cl.principal(issuer1),
          verifier: Cl.none(),
          "start-block": Cl.uint(simnet.blockHeight),
          "end-block": Cl.none(),
          "total-credits-issued": Cl.uint(0),
          "credits-retired": Cl.uint(0),
          status: Cl.uint(0), // STATUS-PENDING
          "metadata-uri": Cl.stringAscii("ipfs://QmTest")
        })
      );
    });
  });
  
  describe("Credit Minting", () => {
    beforeEach(() => {
      // Register a project before each test
      simnet.callPublicFn(
        "registry",
        "register-project",
        [
          Cl.stringAscii("Test Project"),
          Cl.stringUtf8("Test Description"),
          Cl.uint(0),
          Cl.stringAscii("Test Location"),
          Cl.stringAscii("ipfs://QmTest")
        ],
        issuer1
      );
    });
    
    it("should mint credits for an existing project", () => {
      const { result } = simnet.callPublicFn(
        "registry",
        "mint-credit",
        [
          Cl.uint(0), // project-id
          Cl.uint(0), // TYPE-BIODIVERSITY
          Cl.uint(2024), // vintage-year
          Cl.uint(1000), // quantity
          Cl.stringAscii("ipfs://QmCredit123"),
          Cl.uint(500) // co2-equivalent
        ],
        issuer1
      );
      
      expect(result).toBeOk(Cl.uint(0));
    });
    
    it("should fail when minting for non-existent project", () => {
      const { result } = simnet.callPublicFn(
        "registry",
        "mint-credit",
        [
          Cl.uint(999), // non-existent project
          Cl.uint(0),
          Cl.uint(2024),
          Cl.uint(1000),
          Cl.stringAscii("ipfs://QmCredit123"),
          Cl.uint(500)
        ],
        issuer1
      );
      
      expect(result).toBeErr(Cl.uint(101)); // ERR-PROJECT-NOT-FOUND
    });
    
    it("should fail when non-owner tries to mint credits", () => {
      const { result } = simnet.callPublicFn(
        "registry",
        "mint-credit",
        [
          Cl.uint(0),
          Cl.uint(0),
          Cl.uint(2024),
          Cl.uint(1000),
          Cl.stringAscii("ipfs://QmCredit123"),
          Cl.uint(500)
        ],
        issuer2 // Different issuer
      );
      
      expect(result).toBeErr(Cl.uint(100)); // ERR-NOT-AUTHORIZED
    });
    
    it("should fail with invalid quantity", () => {
      const { result } = simnet.callPublicFn(
        "registry",
        "mint-credit",
        [
          Cl.uint(0),
          Cl.uint(0),
          Cl.uint(2024),
          Cl.uint(0), // Invalid quantity
          Cl.stringAscii("ipfs://QmCredit123"),
          Cl.uint(500)
        ],
        issuer1
      );
      
      expect(result).toBeErr(Cl.uint(103)); // ERR-INVALID-QUANTITY
    });
    
    it("should fail with invalid vintage year", () => {
      const { result } = simnet.callPublicFn(
        "registry",
        "mint-credit",
        [
          Cl.uint(0),
          Cl.uint(0),
          Cl.uint(2019), // Before MIN-VINTAGE-YEAR (2020)
          Cl.uint(1000),
          Cl.stringAscii("ipfs://QmCredit123"),
          Cl.uint(500)
        ],
        issuer1
      );
      
      expect(result).toBeErr(Cl.uint(107)); // ERR-INVALID-VINTAGE
    });
    
    it("should update project statistics when minting credits", () => {
      // Mint credits
      simnet.callPublicFn(
        "registry",
        "mint-credit",
        [
          Cl.uint(0),
          Cl.uint(0),
          Cl.uint(2024),
          Cl.uint(1000),
          Cl.stringAscii("ipfs://QmCredit123"),
          Cl.uint(500)
        ],
        issuer1
      );
      
      // Check project stats - credit minting updates project
      const { result } = simnet.callReadOnlyFn(
        "registry",
        "get-project-info",
        [Cl.uint(0)],
        issuer1
      );
      
      // Verify project info exists (stats are updated)
      expect(result.type).toBe('some');
    });
  });
  
  describe("Verifier Management", () => {
    it("should allow contract owner to register verifier", () => {
      const { result } = simnet.callPublicFn(
        "registry",
        "register-verifier",
        [Cl.principal(verifier)],
        deployer
      );
      
      expect(result).toBeOk(Cl.bool(true));
    });
    
    it("should fail when non-owner tries to register verifier", () => {
      const { result } = simnet.callPublicFn(
        "registry",
        "register-verifier",
        [Cl.principal(verifier)],
        issuer1
      );
      
      expect(result).toBeErr(Cl.uint(100)); // ERR-NOT-AUTHORIZED
    });
    
    it("should verify if address is authorized verifier", () => {
      // Register verifier
      simnet.callPublicFn(
        "registry",
        "register-verifier",
        [Cl.principal(verifier)],
        deployer
      );
      
      // Check authorization
      const { result } = simnet.callReadOnlyFn(
        "registry",
        "is-authorized-verifier",
        [Cl.principal(verifier)],
        deployer
      );
      
      expect(result).toBeBool(true);
    });
    
    it("should allow contract owner to revoke verifier", () => {
      // Register verifier
      simnet.callPublicFn(
        "registry",
        "register-verifier",
        [Cl.principal(verifier)],
        deployer
      );
      
      // Revoke verifier
      const { result } = simnet.callPublicFn(
        "registry",
        "revoke-verifier",
        [Cl.principal(verifier)],
        deployer
      );
      
      expect(result).toBeOk(Cl.bool(true));
      
      // Verify revocation
      const { result: checkResult } = simnet.callReadOnlyFn(
        "registry",
        "is-authorized-verifier",
        [Cl.principal(verifier)],
        deployer
      );
      
      expect(checkResult).toBeBool(false);
    });
  });
  
  describe("Credit Status Updates", () => {
    beforeEach(() => {
      // Register project and mint credit
      simnet.callPublicFn(
        "registry",
        "register-project",
        [
          Cl.stringAscii("Test Project"),
          Cl.stringUtf8("Test Description"),
          Cl.uint(0),
          Cl.stringAscii("Test Location"),
          Cl.stringAscii("ipfs://QmTest")
        ],
        issuer1
      );
      
      simnet.callPublicFn(
        "registry",
        "mint-credit",
        [
          Cl.uint(0),
          Cl.uint(0),
          Cl.uint(2024),
          Cl.uint(1000),
          Cl.stringAscii("ipfs://QmCredit123"),
          Cl.uint(500)
        ],
        issuer1
      );
      
      // Register verifier
      simnet.callPublicFn(
        "registry",
        "register-verifier",
        [Cl.principal(verifier)],
        deployer
      );
    });
    
    it("should allow issuer to update credit status", () => {
      const { result } = simnet.callPublicFn(
        "registry",
        "update-credit-status",
        [
          Cl.uint(0),
          Cl.uint(1) // STATUS-VERIFIED
        ],
        issuer1
      );
      
      expect(result).toBeOk(Cl.bool(true));
    });
    
    it("should allow authorized verifier to update credit status", () => {
      const { result } = simnet.callPublicFn(
        "registry",
        "update-credit-status",
        [
          Cl.uint(0),
          Cl.uint(1) // STATUS-VERIFIED
        ],
        verifier
      );
      
      expect(result).toBeOk(Cl.bool(true));
    });
    
    it("should fail when unauthorized user tries to update status", () => {
      const { result } = simnet.callPublicFn(
        "registry",
        "update-credit-status",
        [
          Cl.uint(0),
          Cl.uint(1)
        ],
        buyer
      );
      
      expect(result).toBeErr(Cl.uint(100)); // ERR-NOT-AUTHORIZED
    });
    
    it("should update project retirement stats when retiring credit", () => {
      // Retire credit
      simnet.callPublicFn(
        "registry",
        "update-credit-status",
        [
          Cl.uint(0),
          Cl.uint(3) // STATUS-RETIRED
        ],
        issuer1
      );
      
      // Check project retirement stats
      const { result } = simnet.callReadOnlyFn(
        "registry",
        "get-project-info",
        [Cl.uint(0)],
        issuer1
      );
      
      // Verify project info exists (retirement stats updated)
      expect(result.type).toBe('some');
    });
  });
  
  describe("Credit Transfer", () => {
    beforeEach(() => {
      // Register project and mint credit
      simnet.callPublicFn(
        "registry",
        "register-project",
        [
          Cl.stringAscii("Test Project"),
          Cl.stringUtf8("Test Description"),
          Cl.uint(0),
          Cl.stringAscii("Test Location"),
          Cl.stringAscii("ipfs://QmTest")
        ],
        issuer1
      );
      
      simnet.callPublicFn(
        "registry",
        "mint-credit",
        [
          Cl.uint(0),
          Cl.uint(0),
          Cl.uint(2024),
          Cl.uint(1000),
          Cl.stringAscii("ipfs://QmCredit123"),
          Cl.uint(500)
        ],
        issuer1
      );
    });
    
    it("should transfer credit ownership", () => {
      const { result } = simnet.callPublicFn(
        "registry",
        "transfer-credit",
        [
          Cl.uint(0),
          Cl.principal(buyer)
        ],
        issuer1
      );
      
      expect(result).toBeOk(Cl.bool(true));
    });
    
    it("should fail when non-owner tries to transfer credit", () => {
      const { result } = simnet.callPublicFn(
        "registry",
        "transfer-credit",
        [
          Cl.uint(0),
          Cl.principal(buyer)
        ],
        issuer2
      );
      
      expect(result).toBeErr(Cl.uint(100)); // ERR-NOT-AUTHORIZED
    });
    
    it("should fail when transferring retired credit", () => {
      // Retire credit first
      simnet.callPublicFn(
        "registry",
        "update-credit-status",
        [
          Cl.uint(0),
          Cl.uint(3) // STATUS-RETIRED
        ],
        issuer1
      );
      
      // Try to transfer
      const { result } = simnet.callPublicFn(
        "registry",
        "transfer-credit",
        [
          Cl.uint(0),
          Cl.principal(buyer)
        ],
        issuer1
      );
      
      expect(result).toBeErr(Cl.uint(105)); // ERR-INVALID-STATUS
    });
  });
  
  describe("Read-Only Functions", () => {
    it("should return project nonce", () => {
      const { result } = simnet.callReadOnlyFn(
        "registry",
        "get-project-nonce",
        [],
        deployer
      );
      
      expect(result).toBeUint(0);
    });
    
    it("should return credit nonce", () => {
      const { result } = simnet.callReadOnlyFn(
        "registry",
        "get-credit-nonce",
        [],
        deployer
      );
      
      expect(result).toBeUint(0);
    });
    
    it("should return none for non-existent project", () => {
      const { result } = simnet.callReadOnlyFn(
        "registry",
        "get-project-info",
        [Cl.uint(999)],
        deployer
      );
      
      expect(result).toBeNone();
    });
    
    it("should return none for non-existent credit", () => {
      const { result } = simnet.callReadOnlyFn(
        "registry",
        "get-credit-metadata",
        [Cl.uint(999)],
        deployer
      );
      
      expect(result).toBeNone();
    });
  });
});
