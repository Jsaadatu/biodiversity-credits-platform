;; ============================================================================
;; VERIFICATION CONTRACT
;; ============================================================================
;; Purpose: Manage the credit verification workflow for the Biodiversity 
;;          Credits Platform. This contract handles the submission, review, 
;;          approval, and rejection of credits before they can be traded.
;; 
;; Key Features:
;;   - Submit credits for third-party verification
;;   - Approve or reject credits with detailed reasoning
;;   - Track verification history for audit compliance
;;   - Manage authorized verifier registry
;; 
;; Architecture Notes:
;;   - This contract is designed to be independent and modular
;;   - Verification status is tracked separately from the registry contract
;;   - Supports multiple verifiers with reputation tracking
;; ============================================================================

;; ============================================================================
;; ERROR CODES
;; ============================================================================
;; Error codes in the 300-399 range are reserved for the Verification Contract
;; to maintain separation from Registry (100s) and Marketplace (200s)
;; ============================================================================

(define-constant ERR-NOT-AUTHORIZED (err u300))
(define-constant ERR-REQUEST-NOT-FOUND (err u301))
(define-constant ERR-ALREADY-SUBMITTED (err u302))
(define-constant ERR-INVALID-CREDIT-ID (err u303))
(define-constant ERR-ALREADY-VERIFIED (err u304))
(define-constant ERR-ALREADY-REJECTED (err u305))
(define-constant ERR-VERIFIER-NOT-FOUND (err u306))
(define-constant ERR-VERIFIER-ALREADY-EXISTS (err u307))
(define-constant ERR-INVALID-STATUS (err u308))
(define-constant ERR-CANNOT-VERIFY-OWN-CREDIT (err u309))
(define-constant ERR-REQUEST-EXPIRED (err u310))
(define-constant ERR-INVALID-REASON (err u311))

;; ============================================================================
;; CONSTANTS
;; ============================================================================

(define-constant CONTRACT-OWNER tx-sender)

;; Verification status enumeration
;; These values represent the lifecycle states of a verification request
(define-constant VERIFICATION-STATUS-PENDING u0)
(define-constant VERIFICATION-STATUS-APPROVED u1)
(define-constant VERIFICATION-STATUS-REJECTED u2)
(define-constant VERIFICATION-STATUS-EXPIRED u3)

;; Verifier status enumeration
(define-constant VERIFIER-STATUS-ACTIVE u0)
(define-constant VERIFIER-STATUS-SUSPENDED u1)
(define-constant VERIFIER-STATUS-REVOKED u2)

;; Configuration constants
(define-constant MAX-VERIFICATION-BLOCKS u4320) ;; ~30 days at 10 min/block
(define-constant MIN-REASON-LENGTH u10)
(define-constant MAX-REJECTION-REASON-LENGTH u500)

;; ============================================================================
;; DATA VARIABLES
;; ============================================================================

;; Request ID nonce - auto-incrementing counter for unique request IDs
(define-data-var request-id-nonce uint u0)

;; Total statistics for analytics
(define-data-var total-approvals uint u0)
(define-data-var total-rejections uint u0)
(define-data-var total-pending uint u0)

;; ============================================================================
;; DATA MAPS
;; ============================================================================

;; Verification Requests Map
;; Maps request-id -> detailed request information
;; This is the primary data structure for tracking verification requests
(define-map verification-requests
  uint ;; request-id
  {
    credit-id: uint,                              ;; Reference to the credit being verified
    submitter: principal,                         ;; Address that submitted the request
    verifier: (optional principal),               ;; Assigned verifier (if any)
    status: uint,                                 ;; Current verification status
    submission-block: uint,                       ;; Block height when submitted
    resolution-block: (optional uint),            ;; Block height when resolved
    documentation-uri: (string-ascii 200),        ;; URI to supporting documentation
    rejection-reason: (optional (string-utf8 500)) ;; Reason if rejected
  }
)

;; Credit to Request Mapping
;; Maps credit-id -> request-id for quick lookup
;; Enables checking if a credit already has a pending verification
(define-map credit-verification-request
  uint ;; credit-id
  uint ;; request-id
)

;; Verifier Registry Map
;; Maps verifier-address -> verifier information
;; Tracks verifier credentials, reputation, and activity
(define-map verifiers
  principal ;; verifier address
  {
    name: (string-ascii 100),           ;; Verifier organization name
    status: uint,                        ;; Active, suspended, or revoked
    registration-block: uint,            ;; When the verifier was registered
    total-verifications: uint,           ;; Count of all verifications performed
    approvals: uint,                     ;; Count of approvals given
    rejections: uint,                    ;; Count of rejections given
    specializations: (string-ascii 200)  ;; Types of credits they can verify
  }
)

;; Verification History Map
;; Maps credit-id -> list of historical request IDs
;; Maintains complete audit trail for each credit
(define-map verification-history
  uint ;; credit-id
  (list 20 uint) ;; list of request-ids (max 20 verification attempts)
)

;; Submitter's Verification Requests
;; Maps submitter-address -> list of their request IDs
;; Enables users to track their own submissions
(define-map submitter-requests
  principal ;; submitter address
  (list 100 uint) ;; list of request-ids
)

;; Verifier's Assigned Requests
;; Maps verifier-address -> list of assigned request IDs
;; Helps verifiers manage their workload
(define-map verifier-assignments
  principal ;; verifier address
  (list 100 uint) ;; list of request-ids
)

;; ============================================================================
;; READ-ONLY FUNCTIONS
;; ============================================================================

;; Get verification request details by request ID
;; @param request-id: Unique request identifier
;; @returns: Request details tuple or none if not found
(define-read-only (get-verification-request (request-id uint))
  (map-get? verification-requests request-id)
)

;; Get verification status for a specific credit
;; @param credit-id: Credit identifier to check
;; @returns: Tuple with status information or none if never submitted
(define-read-only (get-verification-status (credit-id uint))
  (match (map-get? credit-verification-request credit-id)
    request-id
      (match (map-get? verification-requests request-id)
        request (some {
          request-id: request-id,
          status: (get status request),
          verifier: (get verifier request),
          submission-block: (get submission-block request),
          resolution-block: (get resolution-block request)
        })
        none
      )
    none
  )
)

;; Get verifier information
;; @param verifier-address: Principal address of the verifier
;; @returns: Verifier details tuple or none if not registered
(define-read-only (get-verifier-info (verifier-address principal))
  (map-get? verifiers verifier-address)
)

;; Check if an address is an active verifier
;; @param verifier-address: Principal address to check
;; @returns: True if active verifier, false otherwise
(define-read-only (is-active-verifier (verifier-address principal))
  (match (map-get? verifiers verifier-address)
    verifier (is-eq (get status verifier) VERIFIER-STATUS-ACTIVE)
    false
  )
)

;; Get verification history for a credit
;; @param credit-id: Credit identifier
;; @returns: List of request IDs for this credit
(define-read-only (get-credit-verification-history (credit-id uint))
  (default-to (list) (map-get? verification-history credit-id))
)

;; Get all requests submitted by an address
;; @param submitter: Principal address of the submitter
;; @returns: List of request IDs submitted by this address
(define-read-only (get-submitter-requests (submitter principal))
  (default-to (list) (map-get? submitter-requests submitter))
)

;; Get all requests assigned to a verifier
;; @param verifier-address: Principal address of the verifier
;; @returns: List of request IDs assigned to this verifier
(define-read-only (get-verifier-assignments (verifier-address principal))
  (default-to (list) (map-get? verifier-assignments verifier-address))
)

;; Get current request ID nonce
;; @returns: Current request ID counter value
(define-read-only (get-request-nonce)
  (var-get request-id-nonce)
)

;; Get platform verification statistics
;; @returns: Tuple with total approvals, rejections, and pending counts
(define-read-only (get-verification-stats)
  {
    total-approvals: (var-get total-approvals),
    total-rejections: (var-get total-rejections),
    total-pending: (var-get total-pending)
  }
)

;; Check if a verification request has expired
;; @param request-id: Request identifier to check
;; @returns: True if expired, false otherwise
(define-read-only (is-request-expired (request-id uint))
  (match (map-get? verification-requests request-id)
    request
      (and
        (is-eq (get status request) VERIFICATION-STATUS-PENDING)
        (> stacks-block-height (+ (get submission-block request) MAX-VERIFICATION-BLOCKS))
      )
    false
  )
)

;; ============================================================================
;; PUBLIC FUNCTIONS
;; ============================================================================

;; Submit a credit for verification
;; Creates a new verification request for the specified credit
;; @param credit-id: Credit identifier to submit for verification
;; @param documentation-uri: URI to supporting documentation (IPFS/Arweave)
;; @returns: New request ID on success
(define-public (submit-for-verification
    (credit-id uint)
    (documentation-uri (string-ascii 200))
  )
  (let
    (
      (new-request-id (var-get request-id-nonce))
      (submitter tx-sender)
      (existing-request (map-get? credit-verification-request credit-id))
    )
    
    ;; Validate: Check credit-id is valid (non-zero for practical purposes)
    (asserts! (> credit-id u0) ERR-INVALID-CREDIT-ID)
    
    ;; Validate: Ensure no pending request exists for this credit
    (asserts! 
      (match existing-request
        req-id 
          (match (map-get? verification-requests req-id)
            req (not (is-eq (get status req) VERIFICATION-STATUS-PENDING))
            true
          )
        true
      )
      ERR-ALREADY-SUBMITTED
    )
    
    ;; Create verification request
    (map-set verification-requests new-request-id
      {
        credit-id: credit-id,
        submitter: submitter,
        verifier: none,
        status: VERIFICATION-STATUS-PENDING,
        submission-block: stacks-block-height,
        resolution-block: none,
        documentation-uri: documentation-uri,
        rejection-reason: none
      }
    )
    
    ;; Map credit to this request
    (map-set credit-verification-request credit-id new-request-id)
    
    ;; Update verification history for this credit
    (map-set verification-history credit-id
      (unwrap-panic (as-max-len?
        (append (get-credit-verification-history credit-id) new-request-id)
        u20
      ))
    )
    
    ;; Update submitter's request list
    (map-set submitter-requests submitter
      (unwrap-panic (as-max-len?
        (append (get-submitter-requests submitter) new-request-id)
        u100
      ))
    )
    
    ;; Update statistics
    (var-set total-pending (+ (var-get total-pending) u1))
    
    ;; Increment nonce
    (var-set request-id-nonce (+ new-request-id u1))
    
    ;; Return new request ID
    (ok new-request-id)
  )
)

;; Approve a credit for issuance
;; Only authorized verifiers can approve credits
;; @param request-id: Verification request to approve
;; @returns: True on success
(define-public (approve-credit (request-id uint))
  (let
    (
      (request (unwrap! (map-get? verification-requests request-id) ERR-REQUEST-NOT-FOUND))
      (verifier tx-sender)
      (verifier-info (unwrap! (map-get? verifiers verifier) ERR-VERIFIER-NOT-FOUND))
    )
    
    ;; Validate: Caller must be an active verifier
    (asserts! (is-eq (get status verifier-info) VERIFIER-STATUS-ACTIVE) ERR-NOT-AUTHORIZED)
    
    ;; Validate: Request must be pending
    (asserts! (is-eq (get status request) VERIFICATION-STATUS-PENDING) ERR-ALREADY-VERIFIED)
    
    ;; Validate: Verifier cannot verify their own credit submission
    (asserts! (not (is-eq (get submitter request) verifier)) ERR-CANNOT-VERIFY-OWN-CREDIT)
    
    ;; Validate: Request has not expired
    (asserts! (not (is-request-expired request-id)) ERR-REQUEST-EXPIRED)
    
    ;; Update request status to approved
    (map-set verification-requests request-id
      (merge request {
        status: VERIFICATION-STATUS-APPROVED,
        verifier: (some verifier),
        resolution-block: (some stacks-block-height)
      })
    )
    
    ;; Update verifier statistics
    (map-set verifiers verifier
      (merge verifier-info {
        total-verifications: (+ (get total-verifications verifier-info) u1),
        approvals: (+ (get approvals verifier-info) u1)
      })
    )
    
    ;; Update verifier assignments
    (map-set verifier-assignments verifier
      (unwrap-panic (as-max-len?
        (append (get-verifier-assignments verifier) request-id)
        u100
      ))
    )
    
    ;; Update global statistics
    (var-set total-approvals (+ (var-get total-approvals) u1))
    (var-set total-pending (- (var-get total-pending) u1))
    
    (ok true)
  )
)

;; Reject a credit with a detailed reason
;; Only authorized verifiers can reject credits
;; @param request-id: Verification request to reject
;; @param reason: Detailed explanation for rejection (min 10 chars, max 500 chars)
;; @returns: True on success
(define-public (reject-credit 
    (request-id uint)
    (reason (string-utf8 500))
  )
  (let
    (
      (request (unwrap! (map-get? verification-requests request-id) ERR-REQUEST-NOT-FOUND))
      (verifier tx-sender)
      (verifier-info (unwrap! (map-get? verifiers verifier) ERR-VERIFIER-NOT-FOUND))
      (reason-length (len reason))
    )
    
    ;; Validate: Caller must be an active verifier
    (asserts! (is-eq (get status verifier-info) VERIFIER-STATUS-ACTIVE) ERR-NOT-AUTHORIZED)
    
    ;; Validate: Request must be pending
    (asserts! (is-eq (get status request) VERIFICATION-STATUS-PENDING) ERR-ALREADY-REJECTED)
    
    ;; Validate: Verifier cannot verify their own credit submission
    (asserts! (not (is-eq (get submitter request) verifier)) ERR-CANNOT-VERIFY-OWN-CREDIT)
    
    ;; Validate: Reason must be meaningful (minimum length)
    (asserts! (>= reason-length MIN-REASON-LENGTH) ERR-INVALID-REASON)
    
    ;; Validate: Request has not expired
    (asserts! (not (is-request-expired request-id)) ERR-REQUEST-EXPIRED)
    
    ;; Update request status to rejected
    (map-set verification-requests request-id
      (merge request {
        status: VERIFICATION-STATUS-REJECTED,
        verifier: (some verifier),
        resolution-block: (some stacks-block-height),
        rejection-reason: (some reason)
      })
    )
    
    ;; Update verifier statistics
    (map-set verifiers verifier
      (merge verifier-info {
        total-verifications: (+ (get total-verifications verifier-info) u1),
        rejections: (+ (get rejections verifier-info) u1)
      })
    )
    
    ;; Update verifier assignments
    (map-set verifier-assignments verifier
      (unwrap-panic (as-max-len?
        (append (get-verifier-assignments verifier) request-id)
        u100
      ))
    )
    
    ;; Update global statistics
    (var-set total-rejections (+ (var-get total-rejections) u1))
    (var-set total-pending (- (var-get total-pending) u1))
    
    (ok true)
  )
)

;; Mark an expired request as expired
;; Can be called by anyone to clean up expired requests
;; @param request-id: Request to mark as expired
;; @returns: True on success
(define-public (mark-request-expired (request-id uint))
  (let
    (
      (request (unwrap! (map-get? verification-requests request-id) ERR-REQUEST-NOT-FOUND))
    )
    
    ;; Validate: Request must be pending and expired
    (asserts! (is-eq (get status request) VERIFICATION-STATUS-PENDING) ERR-INVALID-STATUS)
    (asserts! (is-request-expired request-id) ERR-REQUEST-EXPIRED)
    
    ;; Update request status to expired
    (map-set verification-requests request-id
      (merge request {
        status: VERIFICATION-STATUS-EXPIRED,
        resolution-block: (some stacks-block-height)
      })
    )
    
    ;; Update global statistics
    (var-set total-pending (- (var-get total-pending) u1))
    
    (ok true)
  )
)

;; ============================================================================
;; ADMIN FUNCTIONS
;; ============================================================================

;; Register a new verifier
;; Only contract owner can register verifiers
;; @param verifier-address: Principal address of the verifier
;; @param name: Verifier organization name
;; @param specializations: Types of credits they can verify
;; @returns: True on success
(define-public (register-verifier
    (verifier-address principal)
    (name (string-ascii 100))
    (specializations (string-ascii 200))
  )
  (begin
    ;; Only contract owner can register verifiers
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    
    ;; Check verifier doesn't already exist
    (asserts! (is-none (map-get? verifiers verifier-address)) ERR-VERIFIER-ALREADY-EXISTS)
    
    ;; Register verifier
    (map-set verifiers verifier-address
      {
        name: name,
        status: VERIFIER-STATUS-ACTIVE,
        registration-block: stacks-block-height,
        total-verifications: u0,
        approvals: u0,
        rejections: u0,
        specializations: specializations
      }
    )
    
    (ok true)
  )
)

;; Suspend a verifier
;; Only contract owner can suspend verifiers
;; @param verifier-address: Principal address of the verifier to suspend
;; @returns: True on success
(define-public (suspend-verifier (verifier-address principal))
  (let
    (
      (verifier-info (unwrap! (map-get? verifiers verifier-address) ERR-VERIFIER-NOT-FOUND))
    )
    ;; Only contract owner can suspend
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    
    ;; Update verifier status
    (map-set verifiers verifier-address
      (merge verifier-info { status: VERIFIER-STATUS-SUSPENDED })
    )
    
    (ok true)
  )
)

;; Reactivate a suspended verifier
;; Only contract owner can reactivate verifiers
;; @param verifier-address: Principal address of the verifier to reactivate
;; @returns: True on success
(define-public (reactivate-verifier (verifier-address principal))
  (let
    (
      (verifier-info (unwrap! (map-get? verifiers verifier-address) ERR-VERIFIER-NOT-FOUND))
    )
    ;; Only contract owner can reactivate
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    
    ;; Ensure verifier is suspended (not revoked)
    (asserts! (is-eq (get status verifier-info) VERIFIER-STATUS-SUSPENDED) ERR-INVALID-STATUS)
    
    ;; Update verifier status
    (map-set verifiers verifier-address
      (merge verifier-info { status: VERIFIER-STATUS-ACTIVE })
    )
    
    (ok true)
  )
)

;; Revoke a verifier permanently
;; Only contract owner can revoke verifiers
;; @param verifier-address: Principal address of the verifier to revoke
;; @returns: True on success
(define-public (revoke-verifier (verifier-address principal))
  (let
    (
      (verifier-info (unwrap! (map-get? verifiers verifier-address) ERR-VERIFIER-NOT-FOUND))
    )
    ;; Only contract owner can revoke
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    
    ;; Update verifier status
    (map-set verifiers verifier-address
      (merge verifier-info { status: VERIFIER-STATUS-REVOKED })
    )
    
    (ok true)
  )
)
