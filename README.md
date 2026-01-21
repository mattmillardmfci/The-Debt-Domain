# FinanceAdvisor 💰

A production-ready financial audit and advisory platform built with Next.js, TypeScript, and Firebase.

> Analyze spending • Optimize budgets • Plan debt payoff • Achieve financial freedom

## ✨ Features

### 📊 Transaction Analysis

- Upload and parse bank statements (CSV format)
- Automatic transaction categorization (250+ merchants)
- Vendor override management
- Confidence scoring for accuracy
- 120+ days of historical analysis

### 🏦 Debt Payoff Planning

- Track all debt types (credit cards, loans, mortgages)
- Compare Snowball vs Avalanche strategies
- Calculate interest savings
- Project payoff timelines
- Extra payment simulations

### 💳 Budget Management

- Auto-generate budgets from spending history
- Track spending vs budget by category
- Monthly adjustments
- Overspend alerts
- Category-based analysis

### 🔐 Security & Privacy

- Firebase Authentication
- Email/Password + Google OAuth
- Protected routes
- Encrypted sensitive data
- PCI compliance ready

### 📈 Advanced Analytics

- Spending trends and patterns
- Recurring charge detection
- Category insights
- Net worth tracking
- Financial health scoring

## 🏗️ Tech Stack

**Frontend**

- Next.js 14+ with App Router
- TypeScript (100% type-safe)
- Tailwind CSS
- React Query for state
- Recharts for analytics
- Lucide icons

**Backend**

- Firebase Firestore
- Firebase Auth
- Firebase Cloud Functions
- Cloud Storage

**Quality**

- Jest + React Testing Library (35+ tests)
- ESLint + TypeScript strict mode
- GitHub Actions CI/CD
- Vercel deployment

## 🚀 Quick Start

### Prerequisites

```
Node.js 18+
Firebase project with auth enabled
npm or yarn
```

### Installation

```bash
# Clone and install
git clone https://github.com/yourusername/financial-advisor
cd financial-advisor
npm install --legacy-peer-deps

# Configure Firebase
cp .env.local.example .env.local
# Edit .env.local with your Firebase credentials

# Start development
npm run dev
```

Visit `http://localhost:3000` to get started.

## 📝 Available Commands

```bash
npm run dev            # Start development server
npm run build          # Build for production
npm start              # Start production server
npm test               # Run unit tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Generate coverage report
npm run lint           # Check code style
```

## 📂 Project Structure

```
src/
├── app/                      # Next.js pages & layouts
│   ├── login/               # Auth pages
│   └── dashboard/           # Protected pages
├── components/              # Reusable React components
├── contexts/                # React Context (Auth, etc)
├── lib/                     # Business logic & utilities
│   ├── firebase.ts         # Firebase config
│   ├── categorizer.ts      # Transaction categorization
│   ├── debtCalculator.ts   # Debt payoff math
│   ├── transactionParser.ts # CSV parsing
│   └── __tests__/          # 35+ unit tests
└── types/                  # TypeScript definitions
```

## 🧪 Testing

The project includes comprehensive unit tests:

- **Debt Calculator Tests** (16 tests)
  - Snowball vs Avalanche comparison
  - Interest calculations
  - Payoff projections
  - Edge cases

- **Categorizer Tests** (10 tests)
  - Merchant recognition
  - Category detection
  - Vendor overrides
  - Confidence scoring

- **Parser Tests** (9 tests)
  - Date parsing
  - Amount validation
  - Merchant extraction
  - Transaction validation

```bash
npm test              # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

**Test Results**: ✅ 35/35 passing

## 🔐 Security

- Passwords securely hashed by Firebase
- HTTPS for all communications
- Data encrypted at rest
- Firebase security rules enforce user isolation
- OAuth tokens auto-refresh
- Session timeout after 1 hour

## 📦 Supported Formats

**Bank Statements**

- CSV (Date, Description, Amount)
- Minimum 120 days recommended
- Flexible date formats (MM/DD/YYYY, YYYY-MM-DD)

**File Sizes**

- Up to 10MB per upload
- Bulk import support coming

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Link and deploy
vercel link
vercel --prod
```

### GitHub Actions CI/CD

Automatic on push to main:

1. Run unit tests
2. Build application
3. Deploy to Vercel

**Required Secrets**:

```
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

## 📚 Key Algorithms

### Debt Payoff Calculation

```
Monthly Interest = (APR / 100 / 12) × Balance
Principal = Payment - Interest
New Balance = Current Balance - Principal
```

### Transaction Categorization

- Vendor database matching (exact + fuzzy)
- Keyword detection per category
- User feedback incorporation
- Confidence scoring

### Budget Generation

- Average monthly spending by category
- Automated thresholds
- User customization
- Historical trending

## 🛣️ Roadmap

**Phase 1 (Current)** ✅

- [x] Authentication
- [x] Transaction upload & parsing
- [x] Auto categorization
- [x] Debt payoff planner
- [x] Unit tests

**Phase 2 (Next)**

- [ ] Advanced dashboards
- [ ] OFX file support
- [ ] PDF parsing
- [ ] Budget charts
- [ ] Mobile responsive UX

**Phase 3 (Future)**

- [ ] Family accounts
- [ ] Bank API integration
- [ ] Investment tracking
- [ ] Tax planning
- [ ] Mobile app

## 🤝 Contributing

Contributions welcome!

```bash
# Feature branch workflow
git checkout -b feature/amazing-feature
git commit -m 'Add amazing feature'
git push origin feature/amazing-feature
# Open Pull Request
```

**Guidelines**

- Use TypeScript
- Add tests for features
- Follow ESLint rules
- Update docs

## 📄 License

MIT License - see [LICENSE](LICENSE)

## 💬 Support

- **Bugs**: GitHub Issues
- **Features**: GitHub Discussions
- **Contact**: support@financead visor.dev

## 🙏 Acknowledgments

Built with:

- [Next.js](https://nextjs.org/) - React framework
- [Firebase](https://firebase.google.com/) - Backend
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Recharts](https://recharts.org/) - Charts
- [Jest](https://jestjs.io/) - Testing

---

**Created with ❤️ to help you achieve financial freedom**

Made by Matt Millard • [GitHub](https://github.com) • [Twitter](https://twitter.com)
