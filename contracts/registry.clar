;; Biodiversity Credit Registry Contract
;; Maintains the authoritative registry of all biodiversity credits and conservation projects
;; Enables project registration, credit minting, and metadata management

;; Error Codes
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-PROJECT-NOT-FOUND (err u101))
(define-constant ERR-CREDIT-NOT-FOUND (err u102))
(define-constant ERR-INVALID-QUANTITY (err u103))
(define-constant ERR-ALREADY-EXISTS (err u104))
(define-constant ERR-INVALID-STATUS (err u105))
(define-constant ERR-NOT-VERIFIED (err u106))
(define-constant ERR-INVALID-VINTAGE (err u107))

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant MIN-VINTAGE-YEAR u2020)
(define-constant MAX-VINTAGE-YEAR u2050)

;; Data Variables
(define-data-var project-id-nonce uint u0)
(define-data-var credit-id-nonce uint u0)

;; Credit Status Enumeration
(define-constant STATUS-PENDING u0)
(define-constant STATUS-VERIFIED u1)
(define-constant STATUS-REJECTED u2)
(define-constant STATUS-RETIRED u3)

;; Credit Type Enumeration
(define-constant TYPE-BIODIVERSITY u0)
(define-constant TYPE-CARBON u1)
(define-constant TYPE-WATER u2)

;; Project Data Structure
;; Maps project ID to comprehensive project metadata
(define-map projects
  uint ;; project-id
  {
    name: (string-ascii 100),
    description: (string-utf8 500),
    project-type: uint,
    location: (string-ascii 100),
    issuer: principal,
    verifier: (optional principal),
    start-block: uint,
    end-block: (optional uint),
    total-credits-issued: uint,
    credits-retired: uint,
    status: uint,
    metadata-uri: (string-ascii 200)
  }
)

;; Credit Data Structure
;; Maps credit ID to credit details and ownership information
(define-map credits
  uint ;; credit-id
  {
    project-id: uint,
    credit-type: uint,
    vintage-year: uint,
    quantity: uint,
    issuer: principal,
    owner: principal,
    verification-status: uint,
    verifier: (optional principal),
    verification-block: (optional uint),
    metadata-uri: (string-ascii 200),
    co2-equivalent: uint
  }
)

;; Project Ownership Tracking
;; Maps issuer principal to list of their project IDs
(define-map issuer-projects
  principal
  (list 100 uint)
)

;; Credit Ownership Tracking
;; Maps owner principal to list of their credit IDs
(define-map owner-credits
  principal
  (list 500 uint)
)

;; Authorized Verifiers Registry
(define-map authorized-verifiers
  principal
  bool
)

;; Read-Only Functions

;; Get project information by ID
;; @param project-id: Unique project identifier
;; @returns: Project details tuple or none if not found
(define-read-only (get-project-info (project-id uint))
  (map-get? projects project-id)
)

;; Get credit metadata by ID
;; @param credit-id: Unique credit identifier
;; @returns: Credit details tuple or none if not found
(define-read-only (get-credit-metadata (credit-id uint))
  (map-get? credits credit-id)
)

;; Get all projects owned by an issuer
;; @param issuer: Principal address of the issuer
;; @returns: List of project IDs owned by the issuer
(define-read-only (get-issuer-projects (issuer principal))
  (default-to (list) (map-get? issuer-projects issuer))
)

;; Get all credits owned by an address
;; @param owner: Principal address of the credit owner
;; @returns: List of credit IDs owned by the address
(define-read-only (get-owner-credits (owner principal))
  (default-to (list) (map-get? owner-credits owner))
)

;; Check if an address is an authorized verifier
;; @param verifier: Principal address to check
;; @returns: True if authorized, false otherwise
(define-read-only (is-authorized-verifier (verifier principal))
  (default-to false (map-get? authorized-verifiers verifier))
)

;; Get the current project ID nonce
;; @returns: Current project ID counter value
(define-read-only (get-project-nonce)
  (var-get project-id-nonce)
)

;; Get the current credit ID nonce
;; @returns: Current credit ID counter value
(define-read-only (get-credit-nonce)
  (var-get credit-id-nonce)
)

;; Public Functions

;; Register a new conservation project
;; @param name: Project name (max 100 characters)
;; @param description: Detailed project description
;; @param project-type: Type identifier (biodiversity, carbon, water)
;; @param location: Geographic location descriptor
;; @param metadata-uri: URI to additional project metadata (IPFS/Arweave)
;; @returns: New project ID on success
(define-public (register-project 
    (name (string-ascii 100))
    (description (string-utf8 500))
    (project-type uint)
    (location (string-ascii 100))
    (metadata-uri (string-ascii 200))
  )
  (let
    (
      (new-project-id (var-get project-id-nonce))
      (issuer tx-sender)
    )
    ;; Create project entry
    (map-set projects new-project-id
      {
        name: name,
        description: description,
        project-type: project-type,
        location: location,
        issuer: issuer,
        verifier: none,
        start-block: stacks-block-height,
        end-block: none,
        total-credits-issued: u0,
        credits-retired: u0,
        status: STATUS-PENDING,
        metadata-uri: metadata-uri
      }
    )
    
    ;; Update issuer's project list
    (map-set issuer-projects issuer
      (unwrap-panic (as-max-len? 
        (append (get-issuer-projects issuer) new-project-id) 
        u100
      ))
    )
    
    ;; Increment project nonce
    (var-set project-id-nonce (+ new-project-id u1))
    
    ;; Return new project ID
    (ok new-project-id)
  )
)

;; Mint new biodiversity credits after verification approval
;; @param project-id: Associated project identifier
;; @param credit-type: Type of credit (biodiversity, carbon, water)
;; @param vintage-year: Year the environmental benefits were generated
;; @param quantity: Amount of credits to mint
;; @param metadata-uri: URI to credit-specific metadata
;; @param co2-equivalent: CO2 equivalent in tons
;; @returns: New credit ID on success
(define-public (mint-credit
    (project-id uint)
    (credit-type uint)
    (vintage-year uint)
    (quantity uint)
    (metadata-uri (string-ascii 200))
    (co2-equivalent uint)
  )
  (let
    (
      (new-credit-id (var-get credit-id-nonce))
      (project (unwrap! (get-project-info project-id) ERR-PROJECT-NOT-FOUND))
      (issuer tx-sender)
    )
    
    ;; Validation checks
    (asserts! (is-eq (get issuer project) issuer) ERR-NOT-AUTHORIZED)
    (asserts! (> quantity u0) ERR-INVALID-QUANTITY)
    (asserts! (and (>= vintage-year MIN-VINTAGE-YEAR) (<= vintage-year MAX-VINTAGE-YEAR)) ERR-INVALID-VINTAGE)
    
    ;; Create credit entry
    (map-set credits new-credit-id
      {
        project-id: project-id,
        credit-type: credit-type,
        vintage-year: vintage-year,
        quantity: quantity,
        issuer: issuer,
        owner: issuer,
        verification-status: STATUS-PENDING,
        verifier: none,
        verification-block: none,
        metadata-uri: metadata-uri,
        co2-equivalent: co2-equivalent
      }
    )
    
    ;; Update owner's credit list
    (map-set owner-credits issuer
      (unwrap-panic (as-max-len? 
        (append (get-owner-credits issuer) new-credit-id) 
        u500
      ))
    )
    
    ;; Update project statistics
    (map-set projects project-id
      (merge project { total-credits-issued: (+ (get total-credits-issued project) quantity) })
    )
    
    ;; Increment credit nonce
    (var-set credit-id-nonce (+ new-credit-id u1))
    
    ;; Return new credit ID
    (ok new-credit-id)
  )
)

;; Update credit verification status
;; @param credit-id: Credit identifier to update
;; @param new-status: New verification status (verified, rejected, retired)
;; @returns: Success or error
(define-public (update-credit-status
    (credit-id uint)
    (new-status uint)
  )
  (let
    (
      (credit (unwrap! (get-credit-metadata credit-id) ERR-CREDIT-NOT-FOUND))
      (caller tx-sender)
    )
    
    ;; Authorization checks
    (asserts! 
      (or 
        (is-eq caller (get issuer credit))
        (is-authorized-verifier caller)
      ) 
      ERR-NOT-AUTHORIZED
    )
    
    ;; Validate status value
    (asserts! (<= new-status STATUS-RETIRED) ERR-INVALID-STATUS)
    
    ;; Update credit status
    (map-set credits credit-id
      (merge credit {
        verification-status: new-status,
        verifier: (if (is-authorized-verifier caller) (some caller) (get verifier credit)),
        verification-block: (if (is-authorized-verifier caller) (some stacks-block-height) (get verification-block credit))
      })
    )
    
    ;; Update project retirement stats if retiring
    (if (is-eq new-status STATUS-RETIRED)
      (let
        ((project (unwrap! (get-project-info (get project-id credit)) ERR-PROJECT-NOT-FOUND)))
        (map-set projects (get project-id credit)
          (merge project { credits-retired: (+ (get credits-retired project) (get quantity credit)) })
        )
      )
      true
    )
    
    (ok true)
  )
)

;; Transfer credit ownership
;; @param credit-id: Credit identifier to transfer
;; @param new-owner: Principal address of new owner
;; @returns: Success or error
(define-public (transfer-credit
    (credit-id uint)
    (new-owner principal)
  )
  (let
    (
      (credit (unwrap! (get-credit-metadata credit-id) ERR-CREDIT-NOT-FOUND))
      (current-owner (get owner credit))
    )
    
    ;; Verify ownership
    (asserts! (is-eq tx-sender current-owner) ERR-NOT-AUTHORIZED)
    
    ;; Ensure credit is not retired
    (asserts! (not (is-eq (get verification-status credit) STATUS-RETIRED)) ERR-INVALID-STATUS)
    
    ;; Update credit owner
    (map-set credits credit-id
      (merge credit { owner: new-owner })
    )
    
    ;; Update new owner's credit list
    (map-set owner-credits new-owner
      (unwrap-panic (as-max-len? 
        (append (get-owner-credits new-owner) credit-id) 
        u500
      ))
    )
    
    (ok true)
  )
)

;; Register an authorized verifier
;; @param verifier: Principal address to authorize
;; @returns: Success or error
(define-public (register-verifier (verifier principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (map-set authorized-verifiers verifier true)
    (ok true)
  )
)

;; Revoke verifier authorization
;; @param verifier: Principal address to revoke
;; @returns: Success or error
(define-public (revoke-verifier (verifier principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (map-delete authorized-verifiers verifier)
    (ok true)
  )
)

;; title: registry
;; version:
;; summary:
;; description:

;; traits
;;

;; token definitions
;;

;; constants
;;

;; data vars
;;

;; data maps
;;

;; public functions
;;

;; read only functions
;;

;; private functions
;;

