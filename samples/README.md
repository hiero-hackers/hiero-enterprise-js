# Samples

Sample projects demonstrating how to use `@hiero-enterprise/*` packages with different Node.js frameworks.

| Sample | Framework | Port | Integration Style |
|--------|-----------|------|-------------------|
| [express-sample](./express-sample) | Express | 3000 | Middleware — `req.hiero.*` |
| [fastify-sample](./fastify-sample) | Fastify | 3001 | Plugin — `app.hiero.*` |
| [nest-sample](./nest-sample) | NestJS | 3002 | DI — `@Inject()` constructors |

## Quick Start

```bash
# 1. Install & build from the repo root
pnpm install && pnpm run build

# 2. Create a .env file inside any sample directory
cat > samples/express-sample/.env << 'EOF'
HIERO_NETWORK=testnet
HIERO_OPERATOR_ID=0.0.YOUR_ACCOUNT_ID
HIERO_OPERATOR_KEY=YOUR_PRIVATE_KEY
EOF

# 3. Run any sample
pnpm --filter hiero-express-sample dev    # port 3000
pnpm --filter hiero-fastify-sample dev    # port 3001
pnpm --filter hiero-nest-sample dev       # port 3002
```

> **Note:** The `.env` file must be placed inside the sample's own directory (e.g. `samples/express-sample/.env`), not in the monorepo root.

## Available Endpoints

All three samples expose the same REST API:

### Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/balance` | Get the operator account HBAR balance |
| `GET` | `/api/accounts/:id` | Look up an account by ID (Mirror Node) |
| `GET` | `/api/accounts/:id/nfts` | List NFTs owned by an account |
| `POST` | `/api/accounts` | Create a new account on-chain *(NestJS only)* |

### Tokens

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tokens/:id` | Look up a token by ID (Mirror Node) |

### Topics (Consensus Service)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/topics/:id/messages` | Get messages for a topic |
| `POST` | `/api/topics` | Create a new consensus topic |
| `POST` | `/api/topics/:id/messages` | Submit a message to a topic |

### Network

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/network/exchange-rates` | Current HBAR ↔ USD exchange rates |
| `GET` | `/api/network/supply` | Total HBAR supply info |

## Example `curl` Commands

```bash
# Get operator balance
curl http://localhost:3000/api/balance

# Look up an account
curl http://localhost:3000/api/accounts/0.0.12345

# Create a new account (NestJS sample on port 3002)
curl -X POST http://localhost:3002/api/accounts \
     -H "Content-Type: application/json" \
     -d '{"memo": "My new account"}'

# Create a topic
curl -X POST http://localhost:3000/api/topics \
     -H "Content-Type: application/json" \
     -d '{"memo": "My first topic"}'

# Submit a message to a topic
curl -X POST http://localhost:3000/api/topics/0.0.TOPIC_ID/messages \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello, Hiero!"}'

# Get exchange rates
curl http://localhost:3000/api/network/exchange-rates
```

