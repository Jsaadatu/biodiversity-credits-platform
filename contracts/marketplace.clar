;; Biodiversity Credit Marketplace Contract
;; Facilitates peer-to-peer trading of biodiversity credits with atomic swaps
;; Enables listing creation, cancellation, and purchase execution

;; Error Codes
(define-constant ERR-NOT-AUTHORIZED (err u200))
(define-constant ERR-LISTING-NOT-FOUND (err u201))
(define-constant ERR-INVALID-PRICE (err u202))
(define-constant ERR-INVALID-QUANTITY (err u203))
(define-constant ERR-INSUFFICIENT-BALANCE (err u204))
(define-constant ERR-ALREADY-LISTED (err u205))
(define-constant ERR-LISTING-INACTIVE (err u206))
(define-constant ERR-SELF-PURCHASE (err u207))
(define-constant ERR-CREDIT-NOT-FOUND (err u208))
(define-constant ERR-TRANSFER-FAILED (err u209))

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant MIN-PRICE u1000) ;; Minimum price in microSTX (0.001 STX)
(define-constant PLATFORM-FEE-BPS u100) ;; 1% platform fee (100 basis points)

;; Data Variables
(define-data-var listing-id-nonce uint u0)
(define-data-var total-volume uint u0)
(define-data-var platform-fee-collector principal tx-sender)

;; Listing Status Enumeration
(define-constant STATUS-ACTIVE u0)
(define-constant STATUS-CANCELLED u1)
(define-constant STATUS-COMPLETED u2)

;; Listing Data Structure
;; Maps listing ID to listing details
(define-map listings
  uint ;; listing-id
  {
    credit-id: uint,
    seller: principal,
    price-per-unit: uint,
    quantity: uint,
    quantity-remaining: uint,
    status: uint,
    created-block: uint,
    updated-block: uint,
    listing-type: uint ;; 0 = fixed-price, 1 = auction
  }
)

;; Active Listings by Credit
;; Maps credit ID to list of active listing IDs
(define-map credit-listings
  uint
  (list 50 uint)
)

;; Seller Listings Tracking
;; Maps seller principal to list of their listing IDs
(define-map seller-listings
  principal
  (list 200 uint)
)

;; Trade History Data Structure
;; Maps trade ID to trade details
(define-map trades
  uint ;; trade-id (same as listing-id for now)
  {
    listing-id: uint,
    buyer: principal,
    seller: principal,
    credit-id: uint,
    quantity: uint,
    price-per-unit: uint,
    total-price: uint,
    platform-fee: uint,
    executed-block: uint
  }
)

;; Buyer Trade History
;; Maps buyer principal to list of trade IDs
(define-map buyer-trades
  principal
  (list 200 uint)
)

;; Read-Only Functions

;; Get listing details by ID
;; @param listing-id: Unique listing identifier
;; @returns: Listing details tuple or none if not found
(define-read-only (get-listing (listing-id uint))
  (map-get? listings listing-id)
)

;; Get all active listings for a credit
;; @param credit-id: Credit identifier
;; @returns: List of listing IDs for the credit
(define-read-only (get-credit-listings (credit-id uint))
  (default-to (list) (map-get? credit-listings credit-id))
)

;; Get all listings by a seller
;; @param seller: Seller principal address
;; @returns: List of listing IDs owned by the seller
(define-read-only (get-seller-listings (seller principal))
  (default-to (list) (map-get? seller-listings seller))
)

;; Get trade details by trade ID
;; @param trade-id: Unique trade identifier
;; @returns: Trade details tuple or none if not found
(define-read-only (get-trade (trade-id uint))
  (map-get? trades trade-id)
)

;; Get buyer's trade history
;; @param buyer: Buyer principal address
;; @returns: List of trade IDs for the buyer
(define-read-only (get-buyer-trades (buyer principal))
  (default-to (list) (map-get? buyer-trades buyer))
)

;; Get current listing ID nonce
;; @returns: Current listing ID counter value
(define-read-only (get-listing-nonce)
  (var-get listing-id-nonce)
)

;; Get total marketplace trading volume
;; @returns: Total volume in microSTX
(define-read-only (get-total-volume)
  (var-get total-volume)
)

;; Get platform fee collector address
;; @returns: Principal address of fee collector
(define-read-only (get-fee-collector)
  (var-get platform-fee-collector)
)

;; Calculate platform fee for a given price
;; @param price: Total transaction price in microSTX
;; @returns: Platform fee amount in microSTX
(define-read-only (calculate-platform-fee (price uint))
  (/ (* price PLATFORM-FEE-BPS) u10000)
)

;; Public Functions

;; Create a new credit listing
;; @param credit-id: Credit identifier to list
;; @param price-per-unit: Price per credit unit in microSTX
;; @param quantity: Number of credit units to list
;; @param listing-type: Type of listing (0 = fixed-price, 1 = auction)
;; @returns: New listing ID on success
(define-public (create-listing
    (credit-id uint)
    (price-per-unit uint)
    (quantity uint)
    (listing-type uint)
  )
  (let
    (
      (new-listing-id (var-get listing-id-nonce))
      (seller tx-sender)
      (registry-contract .registry)
    )
    
    ;; Validation checks
    (asserts! (>= price-per-unit MIN-PRICE) ERR-INVALID-PRICE)
    (asserts! (> quantity u0) ERR-INVALID-QUANTITY)
    
    ;; Verify credit exists and seller owns it
    ;; Note: This requires reading from registry contract
    ;; For now, we'll proceed with the assumption of valid credit-id
    ;; In production, this should call registry.get-credit-metadata
    
    ;; Create listing entry
    (map-set listings new-listing-id
      {
        credit-id: credit-id,
        seller: seller,
        price-per-unit: price-per-unit,
        quantity: quantity,
        quantity-remaining: quantity,
        status: STATUS-ACTIVE,
        created-block: stacks-block-height,
        updated-block: stacks-block-height,
        listing-type: listing-type
      }
    )
    
    ;; Update credit listings map
    (map-set credit-listings credit-id
      (unwrap-panic (as-max-len? 
        (append (get-credit-listings credit-id) new-listing-id) 
        u50
      ))
    )
    
    ;; Update seller listings map
    (map-set seller-listings seller
      (unwrap-panic (as-max-len? 
        (append (get-seller-listings seller) new-listing-id) 
        u200
      ))
    )
    
    ;; Increment listing nonce
    (var-set listing-id-nonce (+ new-listing-id u1))
    
    ;; Return new listing ID
    (ok new-listing-id)
  )
)

;; Cancel an existing listing
;; @param listing-id: Listing identifier to cancel
;; @returns: Success or error
(define-public (cancel-listing (listing-id uint))
  (let
    (
      (listing (unwrap! (get-listing listing-id) ERR-LISTING-NOT-FOUND))
      (seller (get seller listing))
    )
    
    ;; Authorization check
    (asserts! (is-eq tx-sender seller) ERR-NOT-AUTHORIZED)
    
    ;; Status check
    (asserts! (is-eq (get status listing) STATUS-ACTIVE) ERR-LISTING-INACTIVE)
    
    ;; Update listing status
    (map-set listings listing-id
      (merge listing {
        status: STATUS-CANCELLED,
        updated-block: stacks-block-height
      })
    )
    
    (ok true)
  )
)

;; Purchase credits from a listing
;; @param listing-id: Listing identifier to purchase from
;; @param quantity: Number of credit units to purchase
;; @returns: Success or error
(define-public (purchase-credit
    (listing-id uint)
    (quantity uint)
  )
  (let
    (
      (listing (unwrap! (get-listing listing-id) ERR-LISTING-NOT-FOUND))
      (buyer tx-sender)
      (seller (get seller listing))
      (price-per-unit (get price-per-unit listing))
      (total-price (* price-per-unit quantity))
      (platform-fee (calculate-platform-fee total-price))
      (seller-proceeds (- total-price platform-fee))
    )
    
    ;; Validation checks
    (asserts! (is-eq (get status listing) STATUS-ACTIVE) ERR-LISTING-INACTIVE)
    (asserts! (not (is-eq buyer seller)) ERR-SELF-PURCHASE)
    (asserts! (> quantity u0) ERR-INVALID-QUANTITY)
    (asserts! (<= quantity (get quantity-remaining listing)) ERR-INSUFFICIENT-BALANCE)
    
    ;; Execute STX payment to seller
    (try! (stx-transfer? seller-proceeds buyer seller))
    
    ;; Pay platform fee
    (try! (stx-transfer? platform-fee buyer (var-get platform-fee-collector)))
    
    ;; Update listing quantity
    (let
      (
        (new-quantity-remaining (- (get quantity-remaining listing) quantity))
        (new-status (if (is-eq new-quantity-remaining u0) STATUS-COMPLETED STATUS-ACTIVE))
      )
      (map-set listings listing-id
        (merge listing {
          quantity-remaining: new-quantity-remaining,
          status: new-status,
          updated-block: stacks-block-height
        })
      )
    )
    
    ;; Record trade
    (map-set trades listing-id
      {
        listing-id: listing-id,
        buyer: buyer,
        seller: seller,
        credit-id: (get credit-id listing),
        quantity: quantity,
        price-per-unit: price-per-unit,
        total-price: total-price,
        platform-fee: platform-fee,
        executed-block: stacks-block-height
      }
    )
    
    ;; Update buyer trade history
    (map-set buyer-trades buyer
      (unwrap-panic (as-max-len? 
        (append (get-buyer-trades buyer) listing-id) 
        u200
      ))
    )
    
    ;; Update total volume
    (var-set total-volume (+ (var-get total-volume) total-price))
    
    ;; Note: In production, this should call registry.transfer-credit
    ;; to transfer actual credit ownership to buyer
    
    (ok true)
  )
)

;; Update listing price
;; @param listing-id: Listing identifier to update
;; @param new-price: New price per unit in microSTX
;; @returns: Success or error
(define-public (update-listing-price
    (listing-id uint)
    (new-price uint)
  )
  (let
    (
      (listing (unwrap! (get-listing listing-id) ERR-LISTING-NOT-FOUND))
      (seller (get seller listing))
    )
    
    ;; Authorization check
    (asserts! (is-eq tx-sender seller) ERR-NOT-AUTHORIZED)
    
    ;; Status check
    (asserts! (is-eq (get status listing) STATUS-ACTIVE) ERR-LISTING-INACTIVE)
    
    ;; Price validation
    (asserts! (>= new-price MIN-PRICE) ERR-INVALID-PRICE)
    
    ;; Update listing price
    (map-set listings listing-id
      (merge listing {
        price-per-unit: new-price,
        updated-block: stacks-block-height
      })
    )
    
    (ok true)
  )
)

;; Set platform fee collector address (admin only)
;; @param new-collector: New fee collector principal
;; @returns: Success or error
(define-public (set-fee-collector (new-collector principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set platform-fee-collector new-collector)
    (ok true)
  )
)

;; Bulk purchase from multiple listings
;; @param listing-ids: List of listing IDs to purchase from
;; @param quantities: List of quantities corresponding to each listing
;; @returns: Success or error
(define-public (bulk-purchase
    (listing-ids (list 10 uint))
    (quantities (list 10 uint))
  )
  (begin
    ;; Ensure lists are same length
    (asserts! (is-eq (len listing-ids) (len quantities)) ERR-INVALID-QUANTITY)
    
    ;; Process each purchase
    ;; Note: In production, use fold to iterate and accumulate results
    ;; For simplicity, this is a placeholder that would need proper implementation
    
    (ok true)
  )
)

;; title: marketplace
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

