/**
 * Verification Contract Test Suite
 * =================================
 * Comprehensive tests for the Biodiversity Credits Verification Contract.
 * 
 * This test suite covers:
 * - Verifier registration and management
 * - Verification request submission
 * - Credit approval workflow
 * - Credit rejection workflow
 * - Request expiration handling
 * - Access control and authorization
 * - Edge cases and error conditions
 */

import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

// Get test accounts from simnet
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const issuer1 = accounts.get("wallet_1")!;
const issuer2 = accounts.get("wallet_2")!;
const verifier1 = accounts.get("wallet_3")!;
const verifier2 = accounts.get("wallet_4")!;
const regularUser = accounts.get("wallet_5")!;

// Constants matching contract definitions
const VERIFICATION_STATUS_PENDING = 0;
const VERIFICATION_STATUS_APPROVED = 1;
const VERIFICATION_STATUS_REJECTED = 2;
const VERIFICATION_STATUS_EXPIRED = 3;

const VERIFIER_STATUS_ACTIVE = 0;
const VERIFIER_STATUS_SUSPENDED = 1;
const VERIFIER_STATUS_REVOKED = 2;

// Error codes
const ERR_NOT_AUTHORIZED = 300;
const ERR_REQUEST_NOT_FOUND = 301;
const ERR_ALREADY_SUBMITTED = 302;
const ERR_INVALID_CREDIT_ID = 303;
const ERR_ALREADY_VERIFIED = 304;
const ERR_ALREADY_REJECTED = 305;
const ERR_VERIFIER_NOT_FOUND = 306;
const ERR_VERIFIER_ALREADY_EXISTS = 307;
const ERR_INVALID_STATUS = 308;
const ERR_CANNOT_VERIFY_OWN_CREDIT = 309;
const ERR_REQUEST_EXPIRED = 310;
const ERR_INVALID_REASON = 311;

describe("Verification Contract", () => {
  
  // =========================================================================
  // VERIFIER REGISTRATION TESTS
  // =========================================================================
  describe("Verifier Registration", () => {
    
    it("should allow contract owner to register a new verifier", () => {
      const { result } = simnet.callPublicFn(
        "verification",
        "register-verifier",
        [
          Cl.principal(verifier1),
          Cl.stringAscii("Environmental Audit Corp"),
          Cl.stringAscii("biodiversity,carbon,water")
        ],
        deployer
      );
      
      expect(result).toBeOk(Cl.bool(true));
    });
    
    it("should store verifier information correctly", () => {
      // Register verifier
      simnet.callPublicFn(
        "verification",
        "register-verifier",
        [
          Cl.principal(verifier1),
          Cl.stringAscii("Green Certification Inc"),
          Cl.stringAscii("biodiversity,carbon")
        ],
        deployer
      );
      
      // Retrieve verifier info
      const { result } = simnet.callReadOnlyFn(
        "verification",
        "get-verifier-info",
        [Cl.principal(verifier1)],
        deployer
      );
      
      expect(result).toBeSome(
        Cl.tuple({
          name: Cl.stringAscii("Green Certification Inc"),
          status: Cl.uint(VERIFIER_STATUS_ACTIVE),
          "registration-block": Cl.uint(simnet.blockHeight),
          "total-verifications": Cl.uint(0),
          approvals: Cl.uint(0),
          rejections: Cl.uint(0),
          specializations: Cl.stringAscii("biodiversity,carbon")
        })
      );
    });
    
    it("should fail when non-owner tries to register verifier", () => {
      const { result } = simnet.callPublicFn(
        "verification",
        "register-verifier",
        [
          Cl.principal(verifier1),
          Cl.stringAscii("Unauthorized Verifier"),
          Cl.stringAscii("biodiversity")
        ],
        regularUser
      );
      
      expect(result).toBeErr(Cl.uint(ERR_NOT_AUTHORIZED));
    });
    
    it("should fail when registering duplicate verifier", () => {
      // First registration
      simnet.callPublicFn(
        "verification",
        "register-verifier",
        [
          Cl.principal(verifier1),
          Cl.stringAscii("First Registration"),
          Cl.stringAscii("biodiversity")
        ],
        deployer
      );
      
      // Duplicate registration
      const { result } = simnet.callPublicFn(
        "verification",
        "register-verifier",
        [
          Cl.principal(verifier1),
          Cl.stringAscii("Duplicate Registration"),
          Cl.stringAscii("carbon")
        ],
        deployer
      );
      
      expect(result).toBeErr(Cl.uint(ERR_VERIFIER_ALREADY_EXISTS));
    });
    
    it("should correctly identify active verifiers", () => {
      // Register verifier
      simnet.callPublicFn(
        "verification",
        "register-verifier",
        [
          Cl.principal(verifier1),
          Cl.stringAscii("Active Verifier"),
          Cl.stringAscii("biodiversity")
        ],
        deployer
      );
      
      // Check if active
      const { result: isActive } = simnet.callReadOnlyFn(
        "verification",
        "is-active-verifier",
        [Cl.principal(verifier1)],
        deployer
      );
      
      expect(isActive).toBeBool(true);
      
      // Check non-registered address
      const { result: notActive } = simnet.callReadOnlyFn(
        "verification",
        "is-active-verifier",
        [Cl.principal(regularUser)],
        deployer
      );
      
      expect(notActive).toBeBool(false);
    });
  });
  
  // =========================================================================
  // VERIFIER MANAGEMENT TESTS
  // =========================================================================
  describe("Verifier Management", () => {
    
    beforeEach(() => {
      // Register a verifier for management tests
      simnet.callPublicFn(
        "verification",
        "register-verifier",
        [
          Cl.principal(verifier1),
          Cl.stringAscii("Test Verifier"),
          Cl.stringAscii("biodiversity")
        ],
        deployer
      );
    });
    
    it("should allow owner to suspend a verifier", () => {
      const { result } = simnet.callPublicFn(
        "verification",
        "suspend-verifier",
        [Cl.principal(verifier1)],
        deployer
      );
      
      expect(result).toBeOk(Cl.bool(true));
      
      // Verify status changed
      const { result: verifierInfo } = simnet.callReadOnlyFn(
        "verification",
        "get-verifier-info",
        [Cl.principal(verifier1)],
        deployer
      );
      
      const verifierData = verifierInfo.value as any;
      expect(verifierData.data.status).toEqual(Cl.uint(VERIFIER_STATUS_SUSPENDED));
    });
    
    it("should allow owner to reactivate a suspended verifier", () => {
      // First suspend
      simnet.callPublicFn(
        "verification",
        "suspend-verifier",
        [Cl.principal(verifier1)],
        deployer
      );
      
      // Then reactivate
      const { result } = simnet.callPublicFn(
        "verification",
        "reactivate-verifier",
        [Cl.principal(verifier1)],
        deployer
      );
      
      expect(result).toBeOk(Cl.bool(true));
      
      // Verify status changed back
      const { result: isActive } = simnet.callReadOnlyFn(
        "verification",
        "is-active-verifier",
        [Cl.principal(verifier1)],
        deployer
      );
      
      expect(isActive).toBeBool(true);
    });
    
    it("should allow owner to revoke a verifier", () => {
      const { result } = simnet.callPublicFn(
        "verification",
        "revoke-verifier",
        [Cl.principal(verifier1)],
        deployer
      );
      
      expect(result).toBeOk(Cl.bool(true));
      
      // Verify status changed
      const { result: verifierInfo } = simnet.callReadOnlyFn(
        "verification",
        "get-verifier-info",
        [Cl.principal(verifier1)],
        deployer
      );
      
      const verifierData = verifierInfo.value as any;
      expect(verifierData.data.status).toEqual(Cl.uint(VERIFIER_STATUS_REVOKED));
    });
    
    it("should prevent reactivating a revoked verifier", () => {
      // Revoke first
      simnet.callPublicFn(
        "verification",
        "revoke-verifier",
        [Cl.principal(verifier1)],
        deployer
      );
      
      // Try to reactivate
      const { result } = simnet.callPublicFn(
        "verification",
        "reactivate-verifier",
        [Cl.principal(verifier1)],
        deployer
      );
      
      expect(result).toBeErr(Cl.uint(ERR_INVALID_STATUS));
    });
  });
  
  // =========================================================================
  // VERIFICATION SUBMISSION TESTS
  // =========================================================================
  describe("Submit for Verification", () => {
    
    it("should allow users to submit credits for verification", () => {
      const { result } = simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [
          Cl.uint(1), // credit-id
          Cl.stringAscii("ipfs://QmDocumentation123")
        ],
        issuer1
      );
      
      expect(result).toBeOk(Cl.uint(0)); // First request ID is 0
    });
    
    it("should increment request ID for each submission", () => {
      // First submission
      const { result: result1 } = simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [
          Cl.uint(1),
          Cl.stringAscii("ipfs://QmDoc1")
        ],
        issuer1
      );
      
      // Second submission (different credit)
      const { result: result2 } = simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [
          Cl.uint(2),
          Cl.stringAscii("ipfs://QmDoc2")
        ],
        issuer2
      );
      
      expect(result1).toBeOk(Cl.uint(0));
      expect(result2).toBeOk(Cl.uint(1));
    });
    
    it("should store verification request correctly", () => {
      // Submit request
      simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [
          Cl.uint(5),
          Cl.stringAscii("ipfs://QmTestDocs")
        ],
        issuer1
      );
      
      // Retrieve request
      const { result } = simnet.callReadOnlyFn(
        "verification",
        "get-verification-request",
        [Cl.uint(0)],
        issuer1
      );
      
      expect(result).toBeSome(
        Cl.tuple({
          "credit-id": Cl.uint(5),
          submitter: Cl.principal(issuer1),
          verifier: Cl.none(),
          status: Cl.uint(VERIFICATION_STATUS_PENDING),
          "submission-block": Cl.uint(simnet.blockHeight),
          "resolution-block": Cl.none(),
          "documentation-uri": Cl.stringAscii("ipfs://QmTestDocs"),
          "rejection-reason": Cl.none()
        })
      );
    });
    
    it("should fail when submitting invalid credit ID (zero)", () => {
      const { result } = simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [
          Cl.uint(0), // Invalid credit-id
          Cl.stringAscii("ipfs://QmDoc")
        ],
        issuer1
      );
      
      expect(result).toBeErr(Cl.uint(ERR_INVALID_CREDIT_ID));
    });
    
    it("should fail when credit already has pending verification", () => {
      // First submission
      simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [
          Cl.uint(1),
          Cl.stringAscii("ipfs://QmDoc1")
        ],
        issuer1
      );
      
      // Duplicate submission for same credit
      const { result } = simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [
          Cl.uint(1),
          Cl.stringAscii("ipfs://QmDoc2")
        ],
        issuer1
      );
      
      expect(result).toBeErr(Cl.uint(ERR_ALREADY_SUBMITTED));
    });
    
    it("should update verification history", () => {
      // Submit request
      simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [
          Cl.uint(10),
          Cl.stringAscii("ipfs://QmDoc")
        ],
        issuer1
      );
      
      // Check history
      const { result } = simnet.callReadOnlyFn(
        "verification",
        "get-credit-verification-history",
        [Cl.uint(10)],
        issuer1
      );
      
      expect(result).toEqual(Cl.list([Cl.uint(0)]));
    });
    
    it("should update submitter requests list", () => {
      // Submit request
      simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [
          Cl.uint(1),
          Cl.stringAscii("ipfs://QmDoc")
        ],
        issuer1
      );
      
      // Check submitter's requests
      const { result } = simnet.callReadOnlyFn(
        "verification",
        "get-submitter-requests",
        [Cl.principal(issuer1)],
        issuer1
      );
      
      expect(result).toEqual(Cl.list([Cl.uint(0)]));
    });
    
    it("should update pending statistics", () => {
      // Submit request
      simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [
          Cl.uint(1),
          Cl.stringAscii("ipfs://QmDoc")
        ],
        issuer1
      );
      
      // Check stats
      const { result } = simnet.callReadOnlyFn(
        "verification",
        "get-verification-stats",
        [],
        issuer1
      );
      
      expect(result).toEqual(Cl.tuple({
        "total-approvals": Cl.uint(0),
        "total-rejections": Cl.uint(0),
        "total-pending": Cl.uint(1)
      }));
    });
  });
  
  // =========================================================================
  // CREDIT APPROVAL TESTS
  // =========================================================================
  describe("Approve Credit", () => {
    
    beforeEach(() => {
      // Register verifier
      simnet.callPublicFn(
        "verification",
        "register-verifier",
        [
          Cl.principal(verifier1),
          Cl.stringAscii("Test Verifier"),
          Cl.stringAscii("biodiversity")
        ],
        deployer
      );
      
      // Submit verification request
      simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [
          Cl.uint(1),
          Cl.stringAscii("ipfs://QmTestDocs")
        ],
        issuer1
      );
    });
    
    it("should allow active verifier to approve credit", () => {
      const { result } = simnet.callPublicFn(
        "verification",
        "approve-credit",
        [Cl.uint(0)], // request-id
        verifier1
      );
      
      expect(result).toBeOk(Cl.bool(true));
    });
    
    it("should update request status to approved", () => {
      // Approve
      simnet.callPublicFn(
        "verification",
        "approve-credit",
        [Cl.uint(0)],
        verifier1
      );
      
      // Check status
      const { result } = simnet.callReadOnlyFn(
        "verification",
        "get-verification-status",
        [Cl.uint(1)], // credit-id
        verifier1
      );
      
      const statusData = result.value as any;
      expect(statusData.data.status).toEqual(Cl.uint(VERIFICATION_STATUS_APPROVED));
    });
    
    it("should update verifier statistics on approval", () => {
      // Approve
      simnet.callPublicFn(
        "verification",
        "approve-credit",
        [Cl.uint(0)],
        verifier1
      );
      
      // Check verifier stats
      const { result } = simnet.callReadOnlyFn(
        "verification",
        "get-verifier-info",
        [Cl.principal(verifier1)],
        verifier1
      );
      
      const verifierData = result.value as any;
      expect(verifierData.data["total-verifications"]).toEqual(Cl.uint(1));
      expect(verifierData.data.approvals).toEqual(Cl.uint(1));
      expect(verifierData.data.rejections).toEqual(Cl.uint(0));
    });
    
    it("should update global approval statistics", () => {
      // Approve
      simnet.callPublicFn(
        "verification",
        "approve-credit",
        [Cl.uint(0)],
        verifier1
      );
      
      // Check stats
      const { result } = simnet.callReadOnlyFn(
        "verification",
        "get-verification-stats",
        [],
        verifier1
      );
      
      expect(result).toEqual(Cl.tuple({
        "total-approvals": Cl.uint(1),
        "total-rejections": Cl.uint(0),
        "total-pending": Cl.uint(0)
      }));
    });
    
    it("should fail when non-verifier tries to approve", () => {
      const { result } = simnet.callPublicFn(
        "verification",
        "approve-credit",
        [Cl.uint(0)],
        regularUser
      );
      
      expect(result).toBeErr(Cl.uint(ERR_VERIFIER_NOT_FOUND));
    });
    
    it("should fail when suspended verifier tries to approve", () => {
      // Suspend verifier
      simnet.callPublicFn(
        "verification",
        "suspend-verifier",
        [Cl.principal(verifier1)],
        deployer
      );
      
      // Try to approve
      const { result } = simnet.callPublicFn(
        "verification",
        "approve-credit",
        [Cl.uint(0)],
        verifier1
      );
      
      expect(result).toBeErr(Cl.uint(ERR_NOT_AUTHORIZED));
    });
    
    it("should fail when approving already approved request", () => {
      // First approval
      simnet.callPublicFn(
        "verification",
        "approve-credit",
        [Cl.uint(0)],
        verifier1
      );
      
      // Register second verifier
      simnet.callPublicFn(
        "verification",
        "register-verifier",
        [
          Cl.principal(verifier2),
          Cl.stringAscii("Second Verifier"),
          Cl.stringAscii("biodiversity")
        ],
        deployer
      );
      
      // Try to approve again
      const { result } = simnet.callPublicFn(
        "verification",
        "approve-credit",
        [Cl.uint(0)],
        verifier2
      );
      
      expect(result).toBeErr(Cl.uint(ERR_ALREADY_VERIFIED));
    });
    
    it("should fail when approving non-existent request", () => {
      const { result } = simnet.callPublicFn(
        "verification",
        "approve-credit",
        [Cl.uint(999)], // Non-existent request
        verifier1
      );
      
      expect(result).toBeErr(Cl.uint(ERR_REQUEST_NOT_FOUND));
    });
    
    it("should prevent verifier from approving own submission", () => {
      // Submit request as verifier
      simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [
          Cl.uint(2),
          Cl.stringAscii("ipfs://QmOwnDocs")
        ],
        verifier1
      );
      
      // Try to self-approve
      const { result } = simnet.callPublicFn(
        "verification",
        "approve-credit",
        [Cl.uint(1)], // The new request
        verifier1
      );
      
      expect(result).toBeErr(Cl.uint(ERR_CANNOT_VERIFY_OWN_CREDIT));
    });
  });
  
  // =========================================================================
  // CREDIT REJECTION TESTS
  // =========================================================================
  describe("Reject Credit", () => {
    
    beforeEach(() => {
      // Register verifier
      simnet.callPublicFn(
        "verification",
        "register-verifier",
        [
          Cl.principal(verifier1),
          Cl.stringAscii("Test Verifier"),
          Cl.stringAscii("biodiversity")
        ],
        deployer
      );
      
      // Submit verification request
      simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [
          Cl.uint(1),
          Cl.stringAscii("ipfs://QmTestDocs")
        ],
        issuer1
      );
    });
    
    it("should allow active verifier to reject credit with reason", () => {
      const { result } = simnet.callPublicFn(
        "verification",
        "reject-credit",
        [
          Cl.uint(0),
          Cl.stringUtf8("Documentation insufficient: Missing satellite imagery and biodiversity assessment reports required for verification.")
        ],
        verifier1
      );
      
      expect(result).toBeOk(Cl.bool(true));
    });
    
    it("should store rejection reason", () => {
      const rejectionReason = "Project documentation does not meet Verra VCS standards for biodiversity credits.";
      
      // Reject
      simnet.callPublicFn(
        "verification",
        "reject-credit",
        [
          Cl.uint(0),
          Cl.stringUtf8(rejectionReason)
        ],
        verifier1
      );
      
      // Check request
      const { result } = simnet.callReadOnlyFn(
        "verification",
        "get-verification-request",
        [Cl.uint(0)],
        verifier1
      );
      
      const requestData = result.value as any;
      expect(requestData.data.status).toEqual(Cl.uint(VERIFICATION_STATUS_REJECTED));
      expect(requestData.data["rejection-reason"]).toEqual(Cl.some(Cl.stringUtf8(rejectionReason)));
    });
    
    it("should update verifier rejection statistics", () => {
      // Reject
      simnet.callPublicFn(
        "verification",
        "reject-credit",
        [
          Cl.uint(0),
          Cl.stringUtf8("Missing required documentation and verification data")
        ],
        verifier1
      );
      
      // Check verifier stats
      const { result } = simnet.callReadOnlyFn(
        "verification",
        "get-verifier-info",
        [Cl.principal(verifier1)],
        verifier1
      );
      
      const verifierData = result.value as any;
      expect(verifierData.data["total-verifications"]).toEqual(Cl.uint(1));
      expect(verifierData.data.approvals).toEqual(Cl.uint(0));
      expect(verifierData.data.rejections).toEqual(Cl.uint(1));
    });
    
    it("should fail with rejection reason too short", () => {
      const { result } = simnet.callPublicFn(
        "verification",
        "reject-credit",
        [
          Cl.uint(0),
          Cl.stringUtf8("Too short") // Less than 10 characters
        ],
        verifier1
      );
      
      expect(result).toBeErr(Cl.uint(ERR_INVALID_REASON));
    });
    
    it("should fail when rejecting already rejected request", () => {
      // First rejection
      simnet.callPublicFn(
        "verification",
        "reject-credit",
        [
          Cl.uint(0),
          Cl.stringUtf8("First rejection reason with enough characters")
        ],
        verifier1
      );
      
      // Register second verifier
      simnet.callPublicFn(
        "verification",
        "register-verifier",
        [
          Cl.principal(verifier2),
          Cl.stringAscii("Second Verifier"),
          Cl.stringAscii("biodiversity")
        ],
        deployer
      );
      
      // Try to reject again
      const { result } = simnet.callPublicFn(
        "verification",
        "reject-credit",
        [
          Cl.uint(0),
          Cl.stringUtf8("Second rejection attempt should fail")
        ],
        verifier2
      );
      
      expect(result).toBeErr(Cl.uint(ERR_ALREADY_REJECTED));
    });
    
    it("should allow resubmission after rejection", () => {
      // Reject first
      simnet.callPublicFn(
        "verification",
        "reject-credit",
        [
          Cl.uint(0),
          Cl.stringUtf8("Documentation insufficient for initial review")
        ],
        verifier1
      );
      
      // Resubmit (same credit)
      const { result } = simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [
          Cl.uint(1),
          Cl.stringAscii("ipfs://QmUpdatedDocs")
        ],
        issuer1
      );
      
      expect(result).toBeOk(Cl.uint(1)); // New request ID
    });
  });
  
  // =========================================================================
  // VERIFICATION STATUS QUERY TESTS
  // =========================================================================
  describe("Get Verification Status", () => {
    
    it("should return none for unsubmitted credit", () => {
      const { result } = simnet.callReadOnlyFn(
        "verification",
        "get-verification-status",
        [Cl.uint(999)],
        issuer1
      );
      
      expect(result).toBeNone();
    });
    
    it("should return correct status for pending request", () => {
      // Submit
      simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [
          Cl.uint(5),
          Cl.stringAscii("ipfs://QmDoc")
        ],
        issuer1
      );
      
      // Check status
      const { result } = simnet.callReadOnlyFn(
        "verification",
        "get-verification-status",
        [Cl.uint(5)],
        issuer1
      );
      
      const statusData = result.value as any;
      expect(statusData.data.status).toEqual(Cl.uint(VERIFICATION_STATUS_PENDING));
      expect(statusData.data["request-id"]).toEqual(Cl.uint(0));
    });
  });
  
  // =========================================================================
  // NONCE AND STATISTICS TESTS
  // =========================================================================
  describe("Nonce and Statistics", () => {
    
    it("should track request nonce correctly", () => {
      // Initial nonce
      const { result: initial } = simnet.callReadOnlyFn(
        "verification",
        "get-request-nonce",
        [],
        issuer1
      );
      expect(initial).toEqual(Cl.uint(0));
      
      // After submission
      simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [Cl.uint(1), Cl.stringAscii("ipfs://QmDoc")],
        issuer1
      );
      
      const { result: afterOne } = simnet.callReadOnlyFn(
        "verification",
        "get-request-nonce",
        [],
        issuer1
      );
      expect(afterOne).toEqual(Cl.uint(1));
    });
    
    it("should track comprehensive verification statistics", () => {
      // Register verifier
      simnet.callPublicFn(
        "verification",
        "register-verifier",
        [
          Cl.principal(verifier1),
          Cl.stringAscii("Stats Verifier"),
          Cl.stringAscii("biodiversity")
        ],
        deployer
      );
      
      // Submit multiple requests
      simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [Cl.uint(1), Cl.stringAscii("ipfs://QmDoc1")],
        issuer1
      );
      simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [Cl.uint(2), Cl.stringAscii("ipfs://QmDoc2")],
        issuer1
      );
      simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [Cl.uint(3), Cl.stringAscii("ipfs://QmDoc3")],
        issuer2
      );
      
      // Approve one
      simnet.callPublicFn(
        "verification",
        "approve-credit",
        [Cl.uint(0)],
        verifier1
      );
      
      // Reject one
      simnet.callPublicFn(
        "verification",
        "reject-credit",
        [Cl.uint(1), Cl.stringUtf8("Insufficient documentation provided")],
        verifier1
      );
      
      // Check stats
      const { result } = simnet.callReadOnlyFn(
        "verification",
        "get-verification-stats",
        [],
        issuer1
      );
      
      expect(result).toEqual(Cl.tuple({
        "total-approvals": Cl.uint(1),
        "total-rejections": Cl.uint(1),
        "total-pending": Cl.uint(1)
      }));
    });
  });
  
  // =========================================================================
  // VERIFIER ASSIGNMENTS TESTS
  // =========================================================================
  describe("Verifier Assignments", () => {
    
    beforeEach(() => {
      simnet.callPublicFn(
        "verification",
        "register-verifier",
        [
          Cl.principal(verifier1),
          Cl.stringAscii("Assignment Verifier"),
          Cl.stringAscii("biodiversity")
        ],
        deployer
      );
    });
    
    it("should track verifier assignments after approval", () => {
      // Submit
      simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [Cl.uint(1), Cl.stringAscii("ipfs://QmDoc")],
        issuer1
      );
      
      // Approve
      simnet.callPublicFn(
        "verification",
        "approve-credit",
        [Cl.uint(0)],
        verifier1
      );
      
      // Check assignments
      const { result } = simnet.callReadOnlyFn(
        "verification",
        "get-verifier-assignments",
        [Cl.principal(verifier1)],
        verifier1
      );
      
      expect(result).toEqual(Cl.list([Cl.uint(0)]));
    });
    
    it("should track verifier assignments after rejection", () => {
      // Submit
      simnet.callPublicFn(
        "verification",
        "submit-for-verification",
        [Cl.uint(1), Cl.stringAscii("ipfs://QmDoc")],
        issuer1
      );
      
      // Reject
      simnet.callPublicFn(
        "verification",
        "reject-credit",
        [Cl.uint(0), Cl.stringUtf8("Rejected with valid reason here")],
        verifier1
      );
      
      // Check assignments
      const { result } = simnet.callReadOnlyFn(
        "verification",
        "get-verifier-assignments",
        [Cl.principal(verifier1)],
        verifier1
      );
      
      expect(result).toEqual(Cl.list([Cl.uint(0)]));
    });
  });
});
