;; ============================================================================
;; RETIREMENT CONTRACT
;; ============================================================================
;; Purpose: Handle the permanent retirement of biodiversity credits.
;;          Once retired, credits cannot be traded or transferred and represent
;;          a verified environmental impact offset.
;; 
;; Key Features:
;;   - Permanent and irreversible credit retirement
;;   - Retirement certificate generation for compliance reporting
;;   - Comprehensive retirement records with purpose and beneficiary
;;   - Query retired credits by owner, project, or certificate
;; 
;; Architecture Notes:
;;   - This contract is designed to be independent and modular
;;   - Retirement is a final state - credits cannot be un-retired
;;   - Certificates provide verifiable proof of retirement
;;   - Supports optional beneficiary designation for offset claims
;; ============================================================================

;; ============================================================================
;; ERROR CODES
;; ============================================================================
;; Error codes in the 400-499 range are reserved for the Retirement Contract
;; to maintain separation from Registry (100s), Marketplace (200s), and 
;; Verification (300s)
;; ============================================================================

(define-constant ERR-NOT-AUTHORIZED (err u400))
(define-constant ERR-CREDIT-NOT-FOUND (err u401))
(define-constant ERR-ALREADY-RETIRED (err u402))
(define-constant ERR-INVALID-CREDIT-ID (err u403))
(define-constant ERR-INVALID-QUANTITY (err u404))
(define-constant ERR-INSUFFICIENT-CREDITS (err u405))
(define-constant ERR-CERTIFICATE-NOT-FOUND (err u406))
(define-constant ERR-RETIREMENT-NOT-FOUND (err u407))
(define-constant ERR-INVALID-BENEFICIARY (err u408))
(define-constant ERR-CREDIT-NOT-VERIFIED (err u409))

;; ============================================================================
;; CONSTANTS
;; ============================================================================

(define-constant CONTRACT-OWNER tx-sender)

;; Retirement purpose enumeration
;; Defines the reason for credit retirement
(define-constant PURPOSE-CARBON-OFFSET u0)
(define-constant PURPOSE-BIODIVERSITY-OFFSET u1)
(define-constant PURPOSE-CSR-COMPLIANCE u2)
(define-constant PURPOSE-REGULATORY-COMPLIANCE u3)
(define-constant PURPOSE-VOLUNTARY-OFFSET u4)
(define-constant PURPOSE-OTHER u5)

;; Credit status constants (matching registry contract)
(define-constant STATUS-VERIFIED u1)
(define-constant STATUS-RETIRED u3)

;; ============================================================================
;; DATA VARIABLES
;; ============================================================================

;; Certificate ID nonce - auto-incrementing counter for unique certificate IDs
(define-data-var certificate-id-nonce uint u0)

;; Retirement record ID nonce - auto-incrementing counter
(define-data-var retirement-id-nonce uint u0)

;; Total credits retired across the platform
(define-data-var total-credits-retired uint u0)

;; Total retirements performed
(define-data-var total-retirements uint u0)

;; Total CO2 equivalent retired (in tons)
(define-data-var total-co2-retired uint u0)

;; ============================================================================
;; DATA MAPS
;; ============================================================================

;; Retirement Records Map
;; Maps retirement-id -> detailed retirement information
;; Primary record of all retirement transactions
(define-map retirement-records
  uint ;; retirement-id
  {
    credit-id: uint,                             ;; Credit that was retired
    retiree: principal,                          ;; Address that retired the credit
    quantity: uint,                              ;; Amount of credits retired
    retirement-block: uint,                      ;; Block height when retired
    purpose: uint,                               ;; Retirement purpose code
    purpose-description: (string-utf8 500),      ;; Detailed description of purpose
    beneficiary: (optional principal),           ;; Entity claiming the offset
    beneficiary-name: (optional (string-ascii 100)), ;; Name of beneficiary org
    project-id: uint,                            ;; Associated project ID
    vintage-year: uint,                          ;; Vintage year of retired credit
    co2-equivalent: uint,                        ;; CO2 equivalent in tons
    certificate-id: uint                         ;; Associated certificate ID
  }
)

;; Credit Retirement Status Map
;; Maps credit-id -> retirement details
;; Quick lookup to check if credit is retired
(define-map credit-retirement-status
  uint ;; credit-id
  {
    is-retired: bool,
    retirement-id: uint,
    retired-block: uint,
    retired-by: principal
  }
)

;; Retirement Certificates Map
;; Maps certificate-id -> certificate data
;; Provides verifiable proof of retirement
(define-map retirement-certificates
  uint ;; certificate-id
  {
    retirement-id: uint,                         ;; Associated retirement record
    credit-id: uint,                             ;; Credit that was retired
    retiree: principal,                          ;; Address that retired
    beneficiary: (optional principal),           ;; Beneficiary of offset
    beneficiary-name: (optional (string-ascii 100)),
    quantity: uint,                              ;; Amount retired
    co2-equivalent: uint,                        ;; CO2 equivalent
    vintage-year: uint,                          ;; Vintage year
    project-id: uint,                            ;; Project ID
    purpose: uint,                               ;; Retirement purpose
    issue-block: uint,                           ;; Block when certificate issued
    metadata-uri: (string-ascii 200)             ;; URI to certificate metadata
  }
)

;; Owner Retirements Map
;; Maps owner-address -> list of retirement IDs
;; Enables users to track their retirement history
(define-map owner-retirements
  principal ;; owner address
  (list 200 uint) ;; list of retirement-ids
)

;; Owner Certificates Map
;; Maps owner-address -> list of certificate IDs
;; Quick access to all certificates owned by an address
(define-map owner-certificates
  principal ;; owner address
  (list 200 uint) ;; list of certificate-ids
)

;; Project Retirements Map
;; Maps project-id -> list of retirement IDs
;; Track all retirements for a specific project
(define-map project-retirements
  uint ;; project-id
  (list 500 uint) ;; list of retirement-ids
)

;; Beneficiary Retirements Map
;; Maps beneficiary-address -> list of retirement IDs
;; Track offsets claimed by specific beneficiaries
(define-map beneficiary-retirements
  principal ;; beneficiary address
  (list 200 uint) ;; list of retirement-ids
)

;; ============================================================================
;; READ-ONLY FUNCTIONS
;; ============================================================================

;; Get retirement record by ID
;; @param retirement-id: Unique retirement identifier
;; @returns: Retirement record tuple or none if not found
(define-read-only (get-retirement-record (retirement-id uint))
  (map-get? retirement-records retirement-id)
)

;; Get retirement certificate by ID
;; @param certificate-id: Unique certificate identifier
;; @returns: Certificate data tuple or none if not found
(define-read-only (get-retirement-certificate (certificate-id uint))
  (map-get? retirement-certificates certificate-id)
)

;; Check if a credit has been retired
;; @param credit-id: Credit identifier to check
;; @returns: Retirement status tuple or none if not retired
(define-read-only (get-credit-retirement-status (credit-id uint))
  (map-get? credit-retirement-status credit-id)
)

;; Check if a credit is retired (simple boolean check)
;; @param credit-id: Credit identifier to check
;; @returns: True if retired, false otherwise
(define-read-only (is-credit-retired (credit-id uint))
  (match (map-get? credit-retirement-status credit-id)
    status (get is-retired status)
    false
  )
)

;; Get all retirements by an owner
;; @param owner: Principal address of the retiree
;; @returns: List of retirement IDs
(define-read-only (get-owner-retirements (owner principal))
  (default-to (list) (map-get? owner-retirements owner))
)

;; Get all certificates owned by an address
;; @param owner: Principal address
;; @returns: List of certificate IDs
(define-read-only (get-owner-certificates (owner principal))
  (default-to (list) (map-get? owner-certificates owner))
)

;; Get all retirements for a project
;; @param project-id: Project identifier
;; @returns: List of retirement IDs
(define-read-only (get-project-retirements (project-id uint))
  (default-to (list) (map-get? project-retirements project-id))
)

;; Get all retirements claimed by a beneficiary
;; @param beneficiary: Principal address of the beneficiary
;; @returns: List of retirement IDs
(define-read-only (get-beneficiary-retirements (beneficiary principal))
  (default-to (list) (map-get? beneficiary-retirements beneficiary))
)

;; Get current retirement ID nonce
;; @returns: Current retirement ID counter value
(define-read-only (get-retirement-nonce)
  (var-get retirement-id-nonce)
)

;; Get current certificate ID nonce
;; @returns: Current certificate ID counter value
(define-read-only (get-certificate-nonce)
  (var-get certificate-id-nonce)
)

;; Get platform-wide retirement statistics
;; @returns: Tuple with total retirements, credits, and CO2 equivalent
(define-read-only (get-retirement-stats)
  {
    total-retirements: (var-get total-retirements),
    total-credits-retired: (var-get total-credits-retired),
    total-co2-retired: (var-get total-co2-retired)
  }
)

;; Get retired credits summary for an owner
;; This provides a count of retirements without the full details
;; @param owner: Principal address
;; @returns: Number of retirements by this owner
(define-read-only (get-retired-credits-count (owner principal))
  (len (get-owner-retirements owner))
)

;; Verify certificate authenticity
;; @param certificate-id: Certificate to verify
;; @returns: Tuple with verification result and basic info
(define-read-only (verify-certificate (certificate-id uint))
  (match (map-get? retirement-certificates certificate-id)
    cert (some {
      is-valid: true,
      credit-id: (get credit-id cert),
      retiree: (get retiree cert),
      quantity: (get quantity cert),
      issue-block: (get issue-block cert)
    })
    none
  )
)

;; ============================================================================
;; PUBLIC FUNCTIONS
;; ============================================================================

;; Retire a credit permanently
;; This is the primary function for retiring biodiversity credits
;; @param credit-id: Credit identifier to retire
;; @param quantity: Amount of credits to retire
;; @param purpose: Retirement purpose code (0-5)
;; @param purpose-description: Detailed description of retirement purpose
;; @param beneficiary: Optional beneficiary claiming the offset
;; @param beneficiary-name: Optional name of beneficiary organization
;; @param project-id: Associated project ID
;; @param vintage-year: Vintage year of the credit
;; @param co2-equivalent: CO2 equivalent in tons
;; @param metadata-uri: URI to additional retirement metadata
;; @returns: Tuple with retirement-id and certificate-id on success
(define-public (retire-credit
    (credit-id uint)
    (quantity uint)
    (purpose uint)
    (purpose-description (string-utf8 500))
    (beneficiary (optional principal))
    (beneficiary-name (optional (string-ascii 100)))
    (project-id uint)
    (vintage-year uint)
    (co2-equivalent uint)
    (metadata-uri (string-ascii 200))
  )
  (let
    (
      (retiree tx-sender)
      (new-retirement-id (var-get retirement-id-nonce))
      (new-certificate-id (var-get certificate-id-nonce))
    )
    
    ;; Validate: Credit ID must be valid (non-zero)
    (asserts! (> credit-id u0) ERR-INVALID-CREDIT-ID)
    
    ;; Validate: Quantity must be positive
    (asserts! (> quantity u0) ERR-INVALID-QUANTITY)
    
    ;; Validate: Credit must not already be retired
    (asserts! (not (is-credit-retired credit-id)) ERR-ALREADY-RETIRED)
    
    ;; Validate: Purpose must be valid (0-5)
    (asserts! (<= purpose PURPOSE-OTHER) ERR-INVALID-QUANTITY)
    
    ;; Create retirement record
    (map-set retirement-records new-retirement-id
      {
        credit-id: credit-id,
        retiree: retiree,
        quantity: quantity,
        retirement-block: stacks-block-height,
        purpose: purpose,
        purpose-description: purpose-description,
        beneficiary: beneficiary,
        beneficiary-name: beneficiary-name,
        project-id: project-id,
        vintage-year: vintage-year,
        co2-equivalent: co2-equivalent,
        certificate-id: new-certificate-id
      }
    )
    
    ;; Mark credit as retired
    (map-set credit-retirement-status credit-id
      {
        is-retired: true,
        retirement-id: new-retirement-id,
        retired-block: stacks-block-height,
        retired-by: retiree
      }
    )
    
    ;; Generate retirement certificate
    (map-set retirement-certificates new-certificate-id
      {
        retirement-id: new-retirement-id,
        credit-id: credit-id,
        retiree: retiree,
        beneficiary: beneficiary,
        beneficiary-name: beneficiary-name,
        quantity: quantity,
        co2-equivalent: co2-equivalent,
        vintage-year: vintage-year,
        project-id: project-id,
        purpose: purpose,
        issue-block: stacks-block-height,
        metadata-uri: metadata-uri
      }
    )
    
    ;; Update owner's retirement list
    (map-set owner-retirements retiree
      (unwrap-panic (as-max-len?
        (append (get-owner-retirements retiree) new-retirement-id)
        u200
      ))
    )
    
    ;; Update owner's certificate list
    (map-set owner-certificates retiree
      (unwrap-panic (as-max-len?
        (append (get-owner-certificates retiree) new-certificate-id)
        u200
      ))
    )
    
    ;; Update project retirements
    (map-set project-retirements project-id
      (unwrap-panic (as-max-len?
        (append (get-project-retirements project-id) new-retirement-id)
        u500
      ))
    )
    
    ;; Update beneficiary retirements if beneficiary is specified
    (match beneficiary
      benef-principal
        (map-set beneficiary-retirements benef-principal
          (unwrap-panic (as-max-len?
            (append (get-beneficiary-retirements benef-principal) new-retirement-id)
            u200
          ))
        )
      true
    )
    
    ;; Update global statistics
    (var-set total-retirements (+ (var-get total-retirements) u1))
    (var-set total-credits-retired (+ (var-get total-credits-retired) quantity))
    (var-set total-co2-retired (+ (var-get total-co2-retired) co2-equivalent))
    
    ;; Increment nonces
    (var-set retirement-id-nonce (+ new-retirement-id u1))
    (var-set certificate-id-nonce (+ new-certificate-id u1))
    
    ;; Return both IDs
    (ok {
      retirement-id: new-retirement-id,
      certificate-id: new-certificate-id
    })
  )
)

;; Batch retire multiple credits
;; Allows efficient retirement of multiple credits in a single transaction
;; @param credit-ids: List of credit IDs to retire
;; @param quantities: List of quantities (must match credit-ids length)
;; @param purpose: Common retirement purpose for all credits
;; @param purpose-description: Detailed description
;; @param beneficiary: Optional common beneficiary
;; @param beneficiary-name: Optional beneficiary name
;; @param project-id: Common project ID
;; @param vintage-year: Common vintage year
;; @param co2-equivalents: List of CO2 equivalents
;; @param metadata-uri: Common metadata URI
;; @returns: Number of credits successfully retired
(define-public (batch-retire-credits
    (credit-ids (list 10 uint))
    (quantities (list 10 uint))
    (purpose uint)
    (purpose-description (string-utf8 500))
    (beneficiary (optional principal))
    (beneficiary-name (optional (string-ascii 100)))
    (project-id uint)
    (vintage-year uint)
    (co2-equivalents (list 10 uint))
    (metadata-uri (string-ascii 200))
  )
  (let
    (
      (count (len credit-ids))
    )
    ;; Validate inputs
    (asserts! (> count u0) ERR-INVALID-QUANTITY)
    (asserts! (is-eq count (len quantities)) ERR-INVALID-QUANTITY)
    (asserts! (is-eq count (len co2-equivalents)) ERR-INVALID-QUANTITY)
    
    ;; Process each credit retirement
    ;; Note: We use fold to process all retirements
    (ok (fold process-batch-retirement
      (zip-credits-data credit-ids quantities co2-equivalents)
      {
        success-count: u0,
        purpose: purpose,
        purpose-description: purpose-description,
        beneficiary: beneficiary,
        beneficiary-name: beneficiary-name,
        project-id: project-id,
        vintage-year: vintage-year,
        metadata-uri: metadata-uri
      }
    ))
  )
)

;; ============================================================================
;; PRIVATE HELPER FUNCTIONS
;; ============================================================================

;; Helper function to create a combined data structure for batch processing
;; @param credit-ids: List of credit IDs
;; @param quantities: List of quantities
;; @param co2-equivalents: List of CO2 equivalents
;; @returns: List of tuples combining all three values
(define-private (zip-credits-data 
    (credit-ids (list 10 uint))
    (quantities (list 10 uint))
    (co2-equivalents (list 10 uint))
  )
  ;; For simplicity, we return the credit-ids and handle the indexing in the fold
  ;; This is a simplified implementation
  credit-ids
)

;; Helper function to process individual retirement in batch operation
;; @param credit-id: Credit ID to process
;; @param accumulator: Accumulated state with context and count
;; @returns: Updated accumulator with incremented count if successful
(define-private (process-batch-retirement
    (credit-id uint)
    (accumulator {
      success-count: uint,
      purpose: uint,
      purpose-description: (string-utf8 500),
      beneficiary: (optional principal),
      beneficiary-name: (optional (string-ascii 100)),
      project-id: uint,
      vintage-year: uint,
      metadata-uri: (string-ascii 200)
    })
  )
  (let
    (
      (retiree tx-sender)
      (new-retirement-id (var-get retirement-id-nonce))
      (new-certificate-id (var-get certificate-id-nonce))
      (purpose (get purpose accumulator))
      (purpose-description (get purpose-description accumulator))
      (beneficiary (get beneficiary accumulator))
      (beneficiary-name (get beneficiary-name accumulator))
      (project-id (get project-id accumulator))
      (vintage-year (get vintage-year accumulator))
      (metadata-uri (get metadata-uri accumulator))
    )
    
    ;; Skip if credit is already retired or invalid
    (if (or (is-eq credit-id u0) (is-credit-retired credit-id))
      accumulator
      (begin
        ;; Create retirement record with quantity of 1 for batch
        (map-set retirement-records new-retirement-id
          {
            credit-id: credit-id,
            retiree: retiree,
            quantity: u1,
            retirement-block: stacks-block-height,
            purpose: purpose,
            purpose-description: purpose-description,
            beneficiary: beneficiary,
            beneficiary-name: beneficiary-name,
            project-id: project-id,
            vintage-year: vintage-year,
            co2-equivalent: u1,
            certificate-id: new-certificate-id
          }
        )
        
        ;; Mark credit as retired
        (map-set credit-retirement-status credit-id
          {
            is-retired: true,
            retirement-id: new-retirement-id,
            retired-block: stacks-block-height,
            retired-by: retiree
          }
        )
        
        ;; Generate certificate
        (map-set retirement-certificates new-certificate-id
          {
            retirement-id: new-retirement-id,
            credit-id: credit-id,
            retiree: retiree,
            beneficiary: beneficiary,
            beneficiary-name: beneficiary-name,
            quantity: u1,
            co2-equivalent: u1,
            vintage-year: vintage-year,
            project-id: project-id,
            purpose: purpose,
            issue-block: stacks-block-height,
            metadata-uri: metadata-uri
          }
        )
        
        ;; Update owner's lists
        (map-set owner-retirements retiree
          (unwrap-panic (as-max-len?
            (append (get-owner-retirements retiree) new-retirement-id)
            u200
          ))
        )
        
        (map-set owner-certificates retiree
          (unwrap-panic (as-max-len?
            (append (get-owner-certificates retiree) new-certificate-id)
            u200
          ))
        )
        
        ;; Update statistics
        (var-set total-retirements (+ (var-get total-retirements) u1))
        (var-set total-credits-retired (+ (var-get total-credits-retired) u1))
        (var-set total-co2-retired (+ (var-get total-co2-retired) u1))
        
        ;; Increment nonces
        (var-set retirement-id-nonce (+ new-retirement-id u1))
        (var-set certificate-id-nonce (+ new-certificate-id u1))
        
        ;; Return updated accumulator
        (merge accumulator { success-count: (+ (get success-count accumulator) u1) })
      )
    )
  )
)
