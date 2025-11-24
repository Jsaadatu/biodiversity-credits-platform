# On-Chain Registry and Marketplace for Biodiversity Credits

A decentralized platform for registering, verifying, trading, and retiring biodiversity credits on the Stacks blockchain. This project leverages Bitcoin's security through Stacks Layer 2 to create a transparent, efficient, and compliant marketplace for environmental credits.

## Overview

The On-Chain Registry and Marketplace for Biodiversity Credits enables conservation organizations, corporations, and environmental verifiers to participate in a global biodiversity credit market. By utilizing blockchain technology and smart contracts, the platform provides immutable record-keeping, transparent verification workflows, and efficient peer-to-peer trading of biodiversity credits.

### Key Value Propositions

- **Transparency**: Immutable on-chain record of all biodiversity credit transactions and metadata
- **Efficiency**: Reduced friction in credit issuance, verification, and trading processes
- **Security**: Leverages Bitcoin's security through Stacks Layer 2 architecture
- **Compliance**: Aligns with international environmental standards (Verra, Gold Standard)
- **Accessibility**: Enables global participation without geographic or institutional barriers
- **Interoperability**: Supports integration with existing carbon and biodiversity credit systems

## Features

- **Credit Registration**: Register conservation projects and create biodiversity credit profiles
- **Credit Minting**: Mint biodiversity credits as SIP-009 NFTs or SIP-010 fungible tokens
- **Verification Workflows**: Standardized verification process for credit issuance with multi-verifier support
- **Marketplace Trading**: List, search, and trade biodiversity credits with transparent pricing
- **Bulk Trading**: Support for large-scale credit transactions with volume optimization
- **Credit Retirement**: Permanently retire credits with immutable retirement certificates
- **Wallet Integration**: Connect Stacks-compatible wallets (Xverse, Hiro, etc.)
- **Advanced Search**: Filter and search credits by type, location, vintage year, and verification status
- **Portfolio Management**: Track credit holdings, transaction history, and impact metrics
- **Impact Reporting**: Generate reports on retired credits and environmental impact
- **Compliance Tracking**: Maintain audit trails for regulatory compliance and reporting

## Technology Stack

### Blockchain & Smart Contracts
- **Blockchain**: Stacks (Layer 2 on Bitcoin)
- **Smart Contract Language**: Clarity
- **Token Standards**: SIP-009 (Non-Fungible Tokens), SIP-010 (Fungible Tokens)
- **Development Framework**: Clarinet

### Backend
- **Runtime**: Node.js (ESNext)
- **Language**: TypeScript
- **Testing Framework**: Vitest with Clarinet SDK integration
- **Database**: PostgreSQL (for off-chain data)
- **API**: RESTful API with potential GraphQL support

### Development Tools
- **Package Manager**: npm
- **Configuration**: TOML (Clarinet.toml for smart contract configuration)
- **Type Checking**: TypeScript with strict mode enabled
- **File Formatting**: Unix line endings (LF)

### Network Support
- **Devnet**: Local development environment with pre-configured test accounts
- **Testnet**: Stacks testnet for staging and testing
- **Mainnet**: Production deployment on Stacks mainnet

## Prerequisites

Before setting up the project, ensure you have the following installed:

### Required
- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 9.0.0 or higher (or yarn/pnpm as alternatives)
- **Clarinet**: Version 2.0.0 or higher (Stacks smart contract development tool)

### Optional
- **Docker**: For running local Stacks devnet environment
- **Git**: For version control and repository management
- **Stacks Wallet**: Xverse or Hiro wallet for testnet/mainnet interaction

### System Requirements
- **OS**: macOS, Linux, or Windows (with WSL2 recommended)
- **RAM**: Minimum 4GB (8GB recommended for devnet)
- **Disk Space**: Minimum 2GB for dependencies and devnet data

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/On-Chain-Registry-and-Marketplace-for-Biodiversity-Credits.git
cd On-Chain-Registry-and-Marketplace-for-Biodiversity-Credits
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required dependencies including:
- `@hirosystems/clarinet-sdk`: Clarinet SDK for smart contract testing
- `@stacks/transactions`: Stacks transaction library
- `vitest`: Testing framework
- `vitest-environment-clarinet`: Clarinet environment for Vitest

### 3. Install Clarinet

If you haven't already installed Clarinet globally:

```bash
# Using Homebrew (macOS/Linux)
brew install clarinet

# Using npm
npm install -g @hirosystems/clarinet

# Or download from https://github.com/hirosystems/clarinet/releases
```

Verify installation:

```bash
clarinet --version
```

### 4. Environment Configuration

#### For Devnet (Local Development)

The devnet configuration is pre-configured in `settings/Devnet.toml` with test accounts and balances. No additional setup is required for local development.

#### For Testnet

Update `settings/Testnet.toml` with your testnet account:

```toml
[network]
name = "testnet"
stacks_node_rpc_address = "https://api.testnet.hiro.so"
deployment_fee_rate = 10

[accounts.deployer]
mnemonic = "YOUR_TESTNET_MNEMONIC_HERE"
```

#### For Mainnet

Update `settings/Mainnet.toml` with your mainnet account:

```toml
[network]
name = "mainnet"
stacks_node_rpc_address = "https://api.hiro.so"
deployment_fee_rate = 10

[accounts.deployer]
mnemonic = "YOUR_MAINNET_MNEMONIC_HERE"
```

**Security Note**: Never commit private mnemonics to version control. Use environment variables or secure key management systems in production.

### 5. Verify Installation

```bash
npm run test
```

This should run the test suite and confirm that all dependencies are properly installed.

## Usage

### Running Tests

Execute the test suite:

```bash
# Run tests once
npm run test

# Run tests with coverage and cost analysis
npm run test:report

# Watch mode - automatically re-run tests on file changes
npm run test:watch
```

### Smart Contract Development

#### Create a New Smart Contract

```bash
clarinet contract new <contract-name>
```

This creates a new Clarity contract file in the `contracts/` directory.

#### Check Contract Syntax

```bash
clarinet check
```

#### Run Clarinet REPL

```bash
clarinet repl
```

The REPL allows interactive testing of smart contracts.

### Devnet Operations

#### Start Local Devnet

```bash
clarinet devnet start
```

This starts a local Stacks devnet with:
- Bitcoin node
- Stacks node
- Stacks API
- Stacks Explorer (http://localhost:8000)
- Bitcoin Explorer (http://localhost:8001)

#### Deploy Contracts to Devnet

```bash
clarinet contract deploy --network devnet
```

#### Stop Devnet

```bash
clarinet devnet stop
```

### Testnet Deployment

Deploy contracts to Stacks testnet:

```bash
clarinet contract deploy --network testnet
```

### Mainnet Deployment

Deploy contracts to Stacks mainnet (use with caution):

```bash
clarinet contract deploy --network mainnet
```

## Project Structure

```
.
├── contracts/                  # Clarity smart contracts
│   ├── registry.clar          # Credit registry contract
│   ├── marketplace.clar       # Marketplace trading contract
│   ├── verification.clar      # Verification workflow contract
│   └── retirement.clar        # Credit retirement contract
├── tests/                      # Test files for smart contracts
│   ├── registry.test.ts       # Registry contract tests
│   ├── marketplace.test.ts    # Marketplace contract tests
│   ├── verification.test.ts   # Verification contract tests
│   └── retirement.test.ts     # Retirement contract tests
├── settings/                   # Network configuration files
│   ├── Devnet.toml            # Local development configuration
│   ├── Testnet.toml           # Stacks testnet configuration
│   └── Mainnet.toml           # Stacks mainnet configuration
├── docs/                       # Project documentation
│   └── PRD.md                 # Product Requirements Document
├── Clarinet.toml              # Clarinet project configuration
├── package.json               # Node.js dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── vitest.config.js           # Vitest testing configuration
└── README.md                  # This file
```

### Directory Descriptions

- **contracts/**: Contains all Clarity smart contracts that implement the core business logic for credit registration, marketplace trading, verification, and retirement.

- **tests/**: Contains TypeScript test files using Vitest and the Clarinet SDK. Tests validate smart contract functionality, security, and edge cases.

- **settings/**: Network-specific configuration files for devnet, testnet, and mainnet deployments. Each file contains network parameters and test account mnemonics.

- **docs/**: Project documentation including the Product Requirements Document (PRD) with detailed specifications, user personas, and technical requirements.

## Smart Contracts

The project consists of four core smart contracts that work together to provide the complete biodiversity credit platform:

### 1. Registry Contract (registry.clar)

**Purpose**: Maintains the authoritative registry of all biodiversity credits and conservation projects.

**Key Functions**:
- `register-project()`: Register new conservation projects with metadata
- `mint-credit()`: Mint new biodiversity credits after verification approval
- `get-credit-metadata()`: Retrieve comprehensive credit information
- `update-credit-status()`: Update credit verification and retirement status
- `get-project-info()`: Retrieve project details and statistics

**Data Structures**:
- Project registry: Maps project IDs to project metadata
- Credit registry: Maps credit IDs to credit metadata and ownership
- Verification status: Tracks approval status for each credit

### 2. Marketplace Contract (marketplace.clar)

**Purpose**: Facilitates peer-to-peer trading of biodiversity credits with atomic swaps.

**Key Functions**:
- `create-listing()`: Create new credit listings with price and quantity
- `cancel-listing()`: Cancel existing listings
- `purchase-credit()`: Execute credit purchases with atomic payment
- `get-active-listings()`: Query active marketplace listings
- `get-trade-history()`: Retrieve historical trade data

**Data Structures**:
- Listings: Maps listing IDs to listing details (price, quantity, seller)
- Order book: Maintains price levels and order queues
- Trade history: Records all executed trades with timestamps

### 3. Verification Contract (verification.clar)

**Purpose**: Manages the verification workflow for credit issuance with multi-verifier support.

**Key Functions**:
- `submit-for-verification()`: Submit credits for verification review
- `approve-credit()`: Approve credit issuance after verification
- `reject-credit()`: Reject credit with reason documentation
- `get-verification-status()`: Check current verification status
- `register-verifier()`: Register authorized verifiers

**Data Structures**:
- Verification requests: Tracks pending verification requests
- Verifier registry: Maintains list of authorized verifiers
- Verification history: Immutable record of all verification decisions

### 4. Retirement Contract (retirement.clar)

**Purpose**: Handles permanent retirement of credits with certificate generation.

**Key Functions**:
- `retire-credit()`: Permanently retire credits from circulation
- `get-retirement-certificate()`: Generate retirement proof
- `get-retired-credits()`: Query retired credits by owner
- `get-retirement-stats()`: Retrieve retirement statistics

**Data Structures**:
- Retirement records: Maps retired credits to retirement details
- Retirement certificates: Stores certificate data for reporting
- Retirement history: Tracks all retirement events

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the Repository**: Create a personal fork of the project
2. **Create a Feature Branch**: Use descriptive branch names (e.g., `feature/credit-minting`)
3. **Write Tests**: Ensure all new functionality includes comprehensive tests
4. **Follow Code Style**: Maintain consistency with existing code style and conventions
5. **Document Changes**: Update documentation for new features or changes
6. **Submit Pull Request**: Create a pull request with clear description of changes

### Development Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and run tests
npm run test

# Commit changes
git commit -m "feat: description of changes"

# Push to your fork
git push origin feature/your-feature-name

# Create pull request on GitHub
```

### Code Standards

- **Clarity**: Follow Clarity best practices from the official documentation
- **TypeScript**: Use strict mode with proper type annotations
- **Testing**: Aim for >80% code coverage
- **Documentation**: Include JSDoc comments for complex functions

## License

This project is licensed under the ISC License. See the LICENSE file for details.

## Support & Contact

For questions, issues, or contributions, please:

- **Report Issues**: Use the GitHub Issues tracker
- **Discussions**: Participate in GitHub Discussions
- **Documentation**: Refer to the PRD.md for detailed specifications
- **Stacks Community**: Join the Stacks Discord for blockchain-specific questions

### Useful Resources

- [Stacks Documentation](https://docs.stacks.co)
- [Clarity Language Guide](https://book.clarity-lang.org)
- [Clarinet Documentation](https://github.com/hirosystems/clarinet)
- [Stacks Improvement Proposals](https://github.com/stacksgov/sips)
- [Verra Standards](https://verra.org)
- [Gold Standard](https://www.goldstandard.org)

## Roadmap

### Phase 1: Foundation (Months 1-3)
- Smart contract architecture and design
- Core contract implementation (Registry, Marketplace, Verification, Retirement)
- Comprehensive test suite
- Security audit

### Phase 2: MVP Launch (Months 4-6)
- Complete marketplace functionality
- User authentication and wallet integration
- Search and filtering capabilities
- Mainnet deployment

### Phase 3: Enhancement (Months 7-9)
- Advanced analytics and reporting
- Bulk trading functionality
- External registry integration
- Mobile application

### Phase 4: Scale & Optimize (Months 10-12)
- Performance optimization
- Additional credit types
- Regulatory compliance enhancements
- International expansion

## Acknowledgments

This project builds upon the excellent work of:
- The Stacks community and developers
- Clarity language designers
- Environmental credit standards organizations (Verra, Gold Standard)
- Open-source contributors and maintainers

---

**Last Updated**: October 23, 2025  
**Project Status**: Development

