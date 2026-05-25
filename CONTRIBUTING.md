# Contributing to Nebula Predict 🔮

Thank you for your interest in contributing to Nebula Predict! We welcome contributions from developers of all skill levels. To maintain code quality and collaboration efficiency, please review the following guidelines.

---

## Code of Conduct
By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any violations or inappropriate behavior to the project maintainers.

## Getting Started

### 1. Fork and Clone
- Fork the repository on GitHub.
- Clone your fork locally:
  ```bash
  git clone https://github.com/YOUR_USERNAME/prediction-market-mvp.git
  cd prediction-market-mvp
  ```

### 2. Install Dependencies
Install packages and generate the Prisma local database bindings:
```bash
npm install
```

### 3. Local Database Configuration
1. Duplicate `.env` if not present, and ensure your local variables are set:
   ```env
   DATABASE_URL="file:./dev.db"
   NEXTAUTH_SECRET="your-random-32-character-secret"
   NEXTAUTH_URL="http://localhost:3008"
   ```
2. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

### 4. Running the App
Start the custom Express and Next.js socket server:
```bash
npm run dev
```
Open [http://localhost:3008](http://localhost:3008) to verify that the dashboard runs and default markets are seeded.

---

## Development Workflow

### 1. Create a Branch
Always write code on a descriptive branch, not directly on `main`:
```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Code Style & Linting
- **CSS**: Write vanilla CSS in the appropriate global sheets. Avoid inline styles when styling reusable panels.
- **TypeScript**: Enforce type-safety. Avoid using `any` type definitions unless strictly necessary due to third-party mock interfaces.
- **Verification**: Run `npm run build` locally before submitting a PR to confirm both Next.js and the server build compile without warnings.

### 3. Commit Guidelines
We prefer descriptive, conventional commit messages:
- `feat: add order depth visualizer`
- `fix: resolve race conditions on simultaneous bid cancellation`
- `docs: update deployment guidelines`

---

## Submitting a Pull Request

1. Push your branch to your GitHub fork:
   ```bash
   git push origin feat/your-feature-name
   ```
2. Open a Pull Request from your branch to our repository's `main` branch.
3. Complete the pull request template description detailing:
   - What changes were made and why.
   - How you verified and tested the changes.
   - Any visual changes (attach screenshots for UI additions).
4. Ensure the automated GitHub Actions build workflow passes.
