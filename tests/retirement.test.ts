/**
 * Retirement Contract Test Suite
 * ================================
 * Comprehensive tests for the Biodiversity Credits Retirement Contract.
 * 
 * This test suite covers:
 * - Credit retirement functionality
 * - Certificate generation and verification
 * - Retirement record management
 * - Query functions for retired credits
 * - Statistics and analytics
 * - Edge cases and error conditions
 */

import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

// Get test accounts from simnet
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const owner1 = accounts.get("wallet_1")!;
const owner2 = accounts.get("wallet_2")!;
const beneficiary1 = accounts.get("wallet_3")!;
const beneficiary2 = accounts.get("wallet_4")!;
const regularUser = accounts.get("wallet_5")!;

// Purpose constants matching contract definitions
const PURPOSE_CARBON_OFFSET = 0;
const PURPOSE_BIODIVERSITY_OFFSET = 1;
const PURPOSE_CSR_COMPLIANCE = 2;
const PURPOSE_REGULATORY_COMPLIANCE = 3;
const PURPOSE_VOLUNTARY_OFFSET = 4;
const PURPOSE_OTHER = 5;

// Error codes
const ERR_NOT_AUTHORIZED = 400;
const ERR_CREDIT_NOT_FOUND = 401;
const ERR_ALREADY_RETIRED = 402;
const ERR_INVALID_CREDIT_ID = 403;
const ERR_INVALID_QUANTITY = 404;
const ERR_INSUFFICIENT_CREDITS = 405;
const ERR_CERTIFICATE_NOT_FOUND = 406;
const ERR_RETIREMENT_NOT_FOUND = 407;
const ERR_INVALID_BENEFICIARY = 408;
const ERR_CREDIT_NOT_VERIFIED = 409;

describe("Retirement Contract", () => {
  
  // =========================================================================
  // CREDIT RETIREMENT TESTS
  // =========================================================================
  describe("Retire Credit", () => {
    
    it("should allow users to retire credits", () => {
      const { result } = simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(1), // credit-id
          Cl.uint(100), // quantity
          Cl.uint(PURPOSE_CARBON_OFFSET), // purpose
          Cl.stringUtf8("Retiring credits to offset corporate carbon emissions for Q4 2025"),
          Cl.some(Cl.principal(beneficiary1)), // beneficiary
          Cl.some(Cl.stringAscii("Acme Corporation")), // beneficiary-name
          Cl.uint(1), // project-id
          Cl.uint(2024), // vintage-year
          Cl.uint(50), // co2-equivalent
          Cl.stringAscii("ipfs://QmRetirementCert123") // metadata-uri
        ],
        owner1
      );
      
      expect(result).toBeOk(Cl.tuple({
        "retirement-id": Cl.uint(0),
        "certificate-id": Cl.uint(0)
      }));
    });
    
    it("should store retirement record correctly", () => {
      // Retire credit
      simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(5),
          Cl.uint(200),
          Cl.uint(PURPOSE_BIODIVERSITY_OFFSET),
          Cl.stringUtf8("Biodiversity offset for habitat restoration project"),
          Cl.none(), // no beneficiary
          Cl.none(), // no beneficiary name
          Cl.uint(2),
          Cl.uint(2023),
          Cl.uint(100),
          Cl.stringAscii("ipfs://QmBioOffset456")
        ],
        owner1
      );
      
      // Retrieve record
      const { result } = simnet.callReadOnlyFn(
        "retirement",
        "get-retirement-record",
        [Cl.uint(0)],
        owner1
      );
      
      expect(result).toBeSome(
        Cl.tuple({
          "credit-id": Cl.uint(5),
          retiree: Cl.principal(owner1),
          quantity: Cl.uint(200),
          "retirement-block": Cl.uint(simnet.blockHeight),
          purpose: Cl.uint(PURPOSE_BIODIVERSITY_OFFSET),
          "purpose-description": Cl.stringUtf8("Biodiversity offset for habitat restoration project"),
          beneficiary: Cl.none(),
          "beneficiary-name": Cl.none(),
          "project-id": Cl.uint(2),
          "vintage-year": Cl.uint(2023),
          "co2-equivalent": Cl.uint(100),
          "certificate-id": Cl.uint(0)
        })
      );
    });
    
    it("should generate retirement certificate", () => {
      // Retire credit
      simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(10),
          Cl.uint(50),
          Cl.uint(PURPOSE_VOLUNTARY_OFFSET),
          Cl.stringUtf8("Voluntary offset for environmental sustainability commitment"),
          Cl.some(Cl.principal(beneficiary1)),
          Cl.some(Cl.stringAscii("Green Corp LLC")),
          Cl.uint(3),
          Cl.uint(2024),
          Cl.uint(25),
          Cl.stringAscii("ipfs://QmVoluntaryOffset789")
        ],
        owner1
      );
      
      // Retrieve certificate
      const { result } = simnet.callReadOnlyFn(
        "retirement",
        "get-retirement-certificate",
        [Cl.uint(0)],
        owner1
      );
      
      expect(result).toBeSome(
        Cl.tuple({
          "retirement-id": Cl.uint(0),
          "credit-id": Cl.uint(10),
          retiree: Cl.principal(owner1),
          beneficiary: Cl.some(Cl.principal(beneficiary1)),
          "beneficiary-name": Cl.some(Cl.stringAscii("Green Corp LLC")),
          quantity: Cl.uint(50),
          "co2-equivalent": Cl.uint(25),
          "vintage-year": Cl.uint(2024),
          "project-id": Cl.uint(3),
          purpose: Cl.uint(PURPOSE_VOLUNTARY_OFFSET),
          "issue-block": Cl.uint(simnet.blockHeight),
          "metadata-uri": Cl.stringAscii("ipfs://QmVoluntaryOffset789")
        })
      );
    });
    
    it("should increment IDs for each retirement", () => {
      // First retirement
      const { result: result1 } = simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(1),
          Cl.uint(100),
          Cl.uint(PURPOSE_CARBON_OFFSET),
          Cl.stringUtf8("First retirement for testing ID increment"),
          Cl.none(),
          Cl.none(),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(50),
          Cl.stringAscii("ipfs://QmFirst")
        ],
        owner1
      );
      
      // Second retirement
      const { result: result2 } = simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(2),
          Cl.uint(200),
          Cl.uint(PURPOSE_CARBON_OFFSET),
          Cl.stringUtf8("Second retirement for testing ID increment"),
          Cl.none(),
          Cl.none(),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(100),
          Cl.stringAscii("ipfs://QmSecond")
        ],
        owner2
      );
      
      expect(result1).toBeOk(Cl.tuple({
        "retirement-id": Cl.uint(0),
        "certificate-id": Cl.uint(0)
      }));
      
      expect(result2).toBeOk(Cl.tuple({
        "retirement-id": Cl.uint(1),
        "certificate-id": Cl.uint(1)
      }));
    });
    
    it("should fail when retiring invalid credit ID (zero)", () => {
      const { result } = simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(0), // Invalid credit-id
          Cl.uint(100),
          Cl.uint(PURPOSE_CARBON_OFFSET),
          Cl.stringUtf8("This should fail due to invalid credit ID"),
          Cl.none(),
          Cl.none(),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(50),
          Cl.stringAscii("ipfs://QmInvalid")
        ],
        owner1
      );
      
      expect(result).toBeErr(Cl.uint(ERR_INVALID_CREDIT_ID));
    });
    
    it("should fail when retiring with invalid quantity (zero)", () => {
      const { result } = simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(1),
          Cl.uint(0), // Invalid quantity
          Cl.uint(PURPOSE_CARBON_OFFSET),
          Cl.stringUtf8("This should fail due to zero quantity"),
          Cl.none(),
          Cl.none(),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(50),
          Cl.stringAscii("ipfs://QmZeroQty")
        ],
        owner1
      );
      
      expect(result).toBeErr(Cl.uint(ERR_INVALID_QUANTITY));
    });
    
    it("should fail when retiring already retired credit", () => {
      // First retirement
      simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(5),
          Cl.uint(100),
          Cl.uint(PURPOSE_CARBON_OFFSET),
          Cl.stringUtf8("First retirement of this credit"),
          Cl.none(),
          Cl.none(),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(50),
          Cl.stringAscii("ipfs://QmFirst")
        ],
        owner1
      );
      
      // Try to retire same credit again
      const { result } = simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(5), // Same credit-id
          Cl.uint(50),
          Cl.uint(PURPOSE_CARBON_OFFSET),
          Cl.stringUtf8("This should fail - already retired"),
          Cl.none(),
          Cl.none(),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(25),
          Cl.stringAscii("ipfs://QmDuplicate")
        ],
        owner1
      );
      
      expect(result).toBeErr(Cl.uint(ERR_ALREADY_RETIRED));
    });
    
    it("should update credit retirement status", () => {
      // Retire credit
      simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(15),
          Cl.uint(100),
          Cl.uint(PURPOSE_CSR_COMPLIANCE),
          Cl.stringUtf8("CSR compliance retirement for annual reporting"),
          Cl.none(),
          Cl.none(),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(50),
          Cl.stringAscii("ipfs://QmCSR")
        ],
        owner1
      );
      
      // Check status
      const { result } = simnet.callReadOnlyFn(
        "retirement",
        "get-credit-retirement-status",
        [Cl.uint(15)],
        owner1
      );
      
      expect(result).toBeSome(
        Cl.tuple({
          "is-retired": Cl.bool(true),
          "retirement-id": Cl.uint(0),
          "retired-block": Cl.uint(simnet.blockHeight),
          "retired-by": Cl.principal(owner1)
        })
      );
    });
    
    it("should correctly report credit as retired", () => {
      // Initially not retired
      const { result: notRetired } = simnet.callReadOnlyFn(
        "retirement",
        "is-credit-retired",
        [Cl.uint(20)],
        owner1
      );
      expect(notRetired).toBeBool(false);
      
      // Retire the credit
      simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(20),
          Cl.uint(100),
          Cl.uint(PURPOSE_CARBON_OFFSET),
          Cl.stringUtf8("Retiring credit to test is-retired function"),
          Cl.none(),
          Cl.none(),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(50),
          Cl.stringAscii("ipfs://QmTest")
        ],
        owner1
      );
      
      // Now should be retired
      const { result: isRetired } = simnet.callReadOnlyFn(
        "retirement",
        "is-credit-retired",
        [Cl.uint(20)],
        owner1
      );
      expect(isRetired).toBeBool(true);
    });
  });
  
  // =========================================================================
  // OWNER TRACKING TESTS
  // =========================================================================
  describe("Owner Tracking", () => {
    
    it("should track owner retirements", () => {
      // Multiple retirements by same owner
      simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(1),
          Cl.uint(100),
          Cl.uint(PURPOSE_CARBON_OFFSET),
          Cl.stringUtf8("First retirement by owner"),
          Cl.none(),
          Cl.none(),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(50),
          Cl.stringAscii("ipfs://Qm1")
        ],
        owner1
      );
      
      simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(2),
          Cl.uint(200),
          Cl.uint(PURPOSE_BIODIVERSITY_OFFSET),
          Cl.stringUtf8("Second retirement by owner"),
          Cl.none(),
          Cl.none(),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(100),
          Cl.stringAscii("ipfs://Qm2")
        ],
        owner1
      );
      
      // Check owner retirements
      const { result } = simnet.callReadOnlyFn(
        "retirement",
        "get-owner-retirements",
        [Cl.principal(owner1)],
        owner1
      );
      
      expect(result).toEqual(Cl.list([Cl.uint(0), Cl.uint(1)]));
    });
    
    it("should track owner certificates", () => {
      // Retire credit
      simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(30),
          Cl.uint(150),
          Cl.uint(PURPOSE_REGULATORY_COMPLIANCE),
          Cl.stringUtf8("Regulatory compliance retirement"),
          Cl.none(),
          Cl.none(),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(75),
          Cl.stringAscii("ipfs://QmReg")
        ],
        owner1
      );
      
      // Check owner certificates
      const { result } = simnet.callReadOnlyFn(
        "retirement",
        "get-owner-certificates",
        [Cl.principal(owner1)],
        owner1
      );
      
      expect(result).toEqual(Cl.list([Cl.uint(0)]));
    });
    
    it("should correctly count retired credits for owner", () => {
      // Initial count
      const { result: initial } = simnet.callReadOnlyFn(
        "retirement",
        "get-retired-credits-count",
        [Cl.principal(owner2)],
        owner2
      );
      expect(initial).toEqual(Cl.uint(0));
      
      // Retire some credits
      simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(40),
          Cl.uint(100),
          Cl.uint(PURPOSE_CARBON_OFFSET),
          Cl.stringUtf8("Counting test retirement"),
          Cl.none(),
          Cl.none(),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(50),
          Cl.stringAscii("ipfs://QmCount")
        ],
        owner2
      );
      
      // Check updated count
      const { result: updated } = simnet.callReadOnlyFn(
        "retirement",
        "get-retired-credits-count",
        [Cl.principal(owner2)],
        owner2
      );
      expect(updated).toEqual(Cl.uint(1));
    });
  });
  
  // =========================================================================
  // PROJECT TRACKING TESTS
  // =========================================================================
  describe("Project Tracking", () => {
    
    it("should track project retirements", () => {
      const projectId = 5;
      
      // Multiple retirements for same project
      simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(50),
          Cl.uint(100),
          Cl.uint(PURPOSE_CARBON_OFFSET),
          Cl.stringUtf8("Project retirement 1"),
          Cl.none(),
          Cl.none(),
          Cl.uint(projectId),
          Cl.uint(2024),
          Cl.uint(50),
          Cl.stringAscii("ipfs://QmProj1")
        ],
        owner1
      );
      
      simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(51),
          Cl.uint(200),
          Cl.uint(PURPOSE_BIODIVERSITY_OFFSET),
          Cl.stringUtf8("Project retirement 2"),
          Cl.none(),
          Cl.none(),
          Cl.uint(projectId),
          Cl.uint(2023),
          Cl.uint(100),
          Cl.stringAscii("ipfs://QmProj2")
        ],
        owner2
      );
      
      // Check project retirements
      const { result } = simnet.callReadOnlyFn(
        "retirement",
        "get-project-retirements",
        [Cl.uint(projectId)],
        owner1
      );
      
      expect(result).toEqual(Cl.list([Cl.uint(0), Cl.uint(1)]));
    });
  });
  
  // =========================================================================
  // BENEFICIARY TRACKING TESTS
  // =========================================================================
  describe("Beneficiary Tracking", () => {
    
    it("should track beneficiary retirements", () => {
      // Retire with beneficiary
      simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(60),
          Cl.uint(100),
          Cl.uint(PURPOSE_CSR_COMPLIANCE),
          Cl.stringUtf8("Retirement with beneficiary tracking"),
          Cl.some(Cl.principal(beneficiary1)),
          Cl.some(Cl.stringAscii("Beneficiary Org")),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(50),
          Cl.stringAscii("ipfs://QmBenef")
        ],
        owner1
      );
      
      // Check beneficiary retirements
      const { result } = simnet.callReadOnlyFn(
        "retirement",
        "get-beneficiary-retirements",
        [Cl.principal(beneficiary1)],
        beneficiary1
      );
      
      expect(result).toEqual(Cl.list([Cl.uint(0)]));
    });
    
    it("should not add to beneficiary list when no beneficiary specified", () => {
      // Retire without beneficiary
      simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(61),
          Cl.uint(100),
          Cl.uint(PURPOSE_VOLUNTARY_OFFSET),
          Cl.stringUtf8("Retirement without beneficiary"),
          Cl.none(),
          Cl.none(),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(50),
          Cl.stringAscii("ipfs://QmNoBenef")
        ],
        owner1
      );
      
      // Beneficiary2 should have no retirements
      const { result } = simnet.callReadOnlyFn(
        "retirement",
        "get-beneficiary-retirements",
        [Cl.principal(beneficiary2)],
        beneficiary2
      );
      
      expect(result).toEqual(Cl.list([]));
    });
  });
  
  // =========================================================================
  // CERTIFICATE VERIFICATION TESTS
  // =========================================================================
  describe("Certificate Verification", () => {
    
    it("should verify valid certificate", () => {
      // Create retirement and certificate
      simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(70),
          Cl.uint(250),
          Cl.uint(PURPOSE_CARBON_OFFSET),
          Cl.stringUtf8("Certificate verification test"),
          Cl.none(),
          Cl.none(),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(125),
          Cl.stringAscii("ipfs://QmCertVerify")
        ],
        owner1
      );
      
      // Verify certificate
      const { result } = simnet.callReadOnlyFn(
        "retirement",
        "verify-certificate",
        [Cl.uint(0)],
        regularUser
      );
      
      const certData = result.value as any;
      expect(certData.data["is-valid"]).toEqual(Cl.bool(true));
      expect(certData.data["credit-id"]).toEqual(Cl.uint(70));
      expect(certData.data.retiree).toEqual(Cl.principal(owner1));
      expect(certData.data.quantity).toEqual(Cl.uint(250));
    });
    
    it("should return none for non-existent certificate", () => {
      const { result } = simnet.callReadOnlyFn(
        "retirement",
        "verify-certificate",
        [Cl.uint(999)], // Non-existent certificate
        regularUser
      );
      
      expect(result).toBeNone();
    });
  });
  
  // =========================================================================
  // STATISTICS TESTS
  // =========================================================================
  describe("Retirement Statistics", () => {
    
    it("should track global retirement statistics", () => {
      // Initial stats
      const { result: initial } = simnet.callReadOnlyFn(
        "retirement",
        "get-retirement-stats",
        [],
        owner1
      );
      
      expect(initial).toEqual(Cl.tuple({
        "total-retirements": Cl.uint(0),
        "total-credits-retired": Cl.uint(0),
        "total-co2-retired": Cl.uint(0)
      }));
      
      // Make some retirements
      simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(80),
          Cl.uint(100),
          Cl.uint(PURPOSE_CARBON_OFFSET),
          Cl.stringUtf8("Stats test retirement 1"),
          Cl.none(),
          Cl.none(),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(50),
          Cl.stringAscii("ipfs://QmStats1")
        ],
        owner1
      );
      
      simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(81),
          Cl.uint(200),
          Cl.uint(PURPOSE_BIODIVERSITY_OFFSET),
          Cl.stringUtf8("Stats test retirement 2"),
          Cl.none(),
          Cl.none(),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(100),
          Cl.stringAscii("ipfs://QmStats2")
        ],
        owner2
      );
      
      // Check updated stats
      const { result: updated } = simnet.callReadOnlyFn(
        "retirement",
        "get-retirement-stats",
        [],
        owner1
      );
      
      expect(updated).toEqual(Cl.tuple({
        "total-retirements": Cl.uint(2),
        "total-credits-retired": Cl.uint(300), // 100 + 200
        "total-co2-retired": Cl.uint(150) // 50 + 100
      }));
    });
    
    it("should track retirement nonce correctly", () => {
      // Initial nonce
      const { result: initial } = simnet.callReadOnlyFn(
        "retirement",
        "get-retirement-nonce",
        [],
        owner1
      );
      expect(initial).toEqual(Cl.uint(0));
      
      // After retirement
      simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(90),
          Cl.uint(100),
          Cl.uint(PURPOSE_CARBON_OFFSET),
          Cl.stringUtf8("Nonce test retirement"),
          Cl.none(),
          Cl.none(),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(50),
          Cl.stringAscii("ipfs://QmNonce")
        ],
        owner1
      );
      
      const { result: updated } = simnet.callReadOnlyFn(
        "retirement",
        "get-retirement-nonce",
        [],
        owner1
      );
      expect(updated).toEqual(Cl.uint(1));
    });
    
    it("should track certificate nonce correctly", () => {
      // Initial nonce
      const { result: initial } = simnet.callReadOnlyFn(
        "retirement",
        "get-certificate-nonce",
        [],
        owner1
      );
      expect(initial).toEqual(Cl.uint(0));
      
      // After retirement
      simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(91),
          Cl.uint(100),
          Cl.uint(PURPOSE_CARBON_OFFSET),
          Cl.stringUtf8("Certificate nonce test"),
          Cl.none(),
          Cl.none(),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(50),
          Cl.stringAscii("ipfs://QmCertNonce")
        ],
        owner1
      );
      
      const { result: updated } = simnet.callReadOnlyFn(
        "retirement",
        "get-certificate-nonce",
        [],
        owner1
      );
      expect(updated).toEqual(Cl.uint(1));
    });
  });
  
  // =========================================================================
  // QUERY FUNCTIONS TESTS
  // =========================================================================
  describe("Query Functions", () => {
    
    it("should return none for non-existent retirement record", () => {
      const { result } = simnet.callReadOnlyFn(
        "retirement",
        "get-retirement-record",
        [Cl.uint(999)],
        owner1
      );
      
      expect(result).toBeNone();
    });
    
    it("should return none for non-existent certificate", () => {
      const { result } = simnet.callReadOnlyFn(
        "retirement",
        "get-retirement-certificate",
        [Cl.uint(999)],
        owner1
      );
      
      expect(result).toBeNone();
    });
    
    it("should return none for credit never retired", () => {
      const { result } = simnet.callReadOnlyFn(
        "retirement",
        "get-credit-retirement-status",
        [Cl.uint(999)],
        owner1
      );
      
      expect(result).toBeNone();
    });
    
    it("should return empty list for owner with no retirements", () => {
      const { result } = simnet.callReadOnlyFn(
        "retirement",
        "get-owner-retirements",
        [Cl.principal(regularUser)],
        regularUser
      );
      
      expect(result).toEqual(Cl.list([]));
    });
    
    it("should return empty list for project with no retirements", () => {
      const { result } = simnet.callReadOnlyFn(
        "retirement",
        "get-project-retirements",
        [Cl.uint(999)],
        owner1
      );
      
      expect(result).toEqual(Cl.list([]));
    });
  });
  
  // =========================================================================
  // PURPOSE CODE TESTS
  // =========================================================================
  describe("Retirement Purpose Codes", () => {
    
    it("should accept all valid purpose codes", () => {
      const purposes = [
        PURPOSE_CARBON_OFFSET,
        PURPOSE_BIODIVERSITY_OFFSET,
        PURPOSE_CSR_COMPLIANCE,
        PURPOSE_REGULATORY_COMPLIANCE,
        PURPOSE_VOLUNTARY_OFFSET,
        PURPOSE_OTHER
      ];
      
      for (let i = 0; i < purposes.length; i++) {
        const { result } = simnet.callPublicFn(
          "retirement",
          "retire-credit",
          [
            Cl.uint(100 + i), // Different credit for each
            Cl.uint(10),
            Cl.uint(purposes[i]),
            Cl.stringUtf8(`Testing purpose code ${purposes[i]}`),
            Cl.none(),
            Cl.none(),
            Cl.uint(1),
            Cl.uint(2024),
            Cl.uint(5),
            Cl.stringAscii("ipfs://QmPurpose" + i)
          ],
          owner1
        );
        
        expect(result).toBeOk(Cl.tuple({
          "retirement-id": Cl.uint(i),
          "certificate-id": Cl.uint(i)
        }));
      }
    });
  });
  
  // =========================================================================
  // EDGE CASES TESTS
  // =========================================================================
  describe("Edge Cases", () => {
    
    it("should handle large quantities", () => {
      const { result } = simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(200),
          Cl.uint(999999999), // Large quantity
          Cl.uint(PURPOSE_CARBON_OFFSET),
          Cl.stringUtf8("Large quantity retirement test"),
          Cl.none(),
          Cl.none(),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(500000000),
          Cl.stringAscii("ipfs://QmLarge")
        ],
        owner1
      );
      
      expect(result).toBeOk(Cl.tuple({
        "retirement-id": Cl.uint(0),
        "certificate-id": Cl.uint(0)
      }));
    });
    
    it("should handle long purpose descriptions", () => {
      const longDescription = "A".repeat(500); // Max length
      
      const { result } = simnet.callPublicFn(
        "retirement",
        "retire-credit",
        [
          Cl.uint(201),
          Cl.uint(100),
          Cl.uint(PURPOSE_OTHER),
          Cl.stringUtf8(longDescription),
          Cl.none(),
          Cl.none(),
          Cl.uint(1),
          Cl.uint(2024),
          Cl.uint(50),
          Cl.stringAscii("ipfs://QmLongDesc")
        ],
        owner1
      );
      
      expect(result).toBeOk(Cl.tuple({
        "retirement-id": Cl.uint(0),
        "certificate-id": Cl.uint(0)
      }));
    });
    
    it("should handle various vintage years", () => {
      const vintageYears = [2020, 2021, 2022, 2023, 2024, 2025];
      
      for (let i = 0; i < vintageYears.length; i++) {
        const { result } = simnet.callPublicFn(
          "retirement",
          "retire-credit",
          [
            Cl.uint(300 + i),
            Cl.uint(50),
            Cl.uint(PURPOSE_CARBON_OFFSET),
            Cl.stringUtf8(`Vintage year ${vintageYears[i]} test`),
            Cl.none(),
            Cl.none(),
            Cl.uint(1),
            Cl.uint(vintageYears[i]),
            Cl.uint(25),
            Cl.stringAscii("ipfs://QmVintage" + i)
          ],
          owner1
        );
        
        expect(result).toBeOk(Cl.tuple({
          "retirement-id": Cl.uint(i),
          "certificate-id": Cl.uint(i)
        }));
      }
    });
  });
});
