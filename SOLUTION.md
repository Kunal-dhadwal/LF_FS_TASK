# Fullstack Social Media App - Solution & Architecture Write-up

This document outlines the complete architectural review, bug fixes, enhancements, and production readiness improvements implemented for the fullstack social media application.

---

## Part 1 — Models & Associations

Based on `schema.sql`, all four core Sequelize models were fully implemented with strict typing, validations, and constraints:

### 1. Model Definitions
- **`User`** (`users` table):
  - `id`: `INTEGER`, primary key, auto-increment
  - `username`: `STRING(50)`, unique, not null
  - `email`: `STRING(100)`, unique, not null, email validation
  - `password_hash`: `STRING(255)`, not null
  - `profile_picture_url`: `STRING(255)`
  - `bio`: `TEXT`
  - Options: `tableName: 'users'`, `timestamps: true`, `underscored: true`

- **`Post`** (`posts` table):
  - `id`: `INTEGER`, primary key, auto-increment
  - `user_id`: `INTEGER`, not null, foreign key to `users.id`
  - `title`: `STRING(200)`, not null
  - `content`: `TEXT`, not null
  - `image_url`: `STRING(255)`
  - `likes_count`: `INTEGER`, default `0`
  - Options: `tableName: 'posts'`, `timestamps: true`, `underscored: true`

- **`Comment`** (`comments` table):
  - `id`: `INTEGER`, primary key, auto-increment
  - `post_id`: `INTEGER`, not null, foreign key to `posts.id`
  - `user_id`: `INTEGER`, not null, foreign key to `users.id`
  - `content`: `TEXT`, not null
  - `likes_count`: `INTEGER`, default `0`
  - Options: `tableName: 'comments'`, `timestamps: true`, `underscored: true`

- **`Like`** (`likes` table):
  - `id`: `INTEGER`, primary key, auto-increment
  - `user_id`: `INTEGER`, not null, foreign key to `users.id`
  - `post_id`: `INTEGER`, foreign key to `posts.id` (nullable for comment likes)
  - `comment_id`: `INTEGER`, foreign key to `comments.id` (nullable for post likes)
  - Options: `tableName: 'likes'`, `timestamps: true`, `updatedAt: false`, `underscored: true`

### 2. Model Associations
All foreign key relationships from `schema.sql` were wired up:
- `User.hasMany(Post, { foreignKey: 'user_id', as: 'posts', onDelete: 'CASCADE' })`
- `Post.belongsTo(User, { foreignKey: 'user_id', as: 'author' })`
- `User.hasMany(Comment, { foreignKey: 'user_id', as: 'comments', onDelete: 'CASCADE' })`
- `Comment.belongsTo(User, { foreignKey: 'user_id', as: 'author' })`
- `Post.hasMany(Comment, { foreignKey: 'post_id', as: 'comments', onDelete: 'CASCADE' })`
- `Comment.belongsTo(Post, { foreignKey: 'post_id', as: 'post' })`
- `User.hasMany(Like, { foreignKey: 'user_id', as: 'likes', onDelete: 'CASCADE' })`
- `Like.belongsTo(User, { foreignKey: 'user_id', as: 'user' })`
- `Post.hasMany(Like, { foreignKey: 'post_id', as: 'likes', onDelete: 'CASCADE' })`
- `Like.belongsTo(Post, { foreignKey: 'post_id', as: 'post' })`
- `Comment.hasMany(Like, { foreignKey: 'comment_id', as: 'likes', onDelete: 'CASCADE' })` *(Addresses Bug 8)*
- `Like.belongsTo(Comment, { foreignKey: 'comment_id', as: 'comment' })` *(Addresses Bug 8)*

---

## Part 2 — Bug Fixes Summary

### Bug 1: Non-functional Authentication Middleware
- **Root Cause**: `authenticateToken` was a dummy placeholder that merely invoked `next()` without verifying tokens or populating `req.user`.
- **Fix**: Implemented full JWT authentication that extracts the `Bearer` token from `req.headers['authorization']`, verifies it against `JWT_SECRET`, sets `req.user` with decoded token payload, and returns proper `401 Unauthorized` or `403 Forbidden` responses.

### Bug 2: Runtime Crashes in Unprotected Routes
- **Root Cause**: Handlers for `POST /api/posts`, `PUT /api/posts/:id`, `DELETE /api/posts/:id`, `POST /api/posts/:postId/comments`, `DELETE /api/comments/:id`, `POST /api/posts/:postId/like`, and `DELETE /api/posts/:postId/unlike` attempted to access `req.user.id` without `authenticateToken` being applied. Any request caused an unhandled `TypeError: Cannot read properties of undefined (reading 'id')`.
- **Fix**: Applied `authenticateToken` middleware to all protected routes and verified authorization before allowing mutations (e.g. verifying `post.user_id === req.user.id`).

### Bug 3: Missing Login Endpoint
- **Root Cause**: The application had a registration route (`POST /api/users`), but no login endpoint existed, preventing users from authenticating and obtaining a JWT token.
- **Fix**: Added `POST /api/login` and `GET /api/auth/me`. The login endpoint validates credentials, supports both bcrypt and legacy SHA-256 hashes (for seeded users), generates a signed JWT token, and returns user profile data. Also updated registration to immediately return an auth token upon successful registration.

### Bug 4: Incorrect Association Type in Sequelize Includes
- **Root Cause**: In `GET /api/users/:id`, the `Post` include contained `through: { attributes: [] }`. The `through` option is only valid for `belongsToMany` associations. Because `User` has a `hasMany` relationship with `Post`, Sequelize threw a runtime error.
- **Fix**: Removed `through: { attributes: [] }` and fetched the user's recent posts directly.

### Bug 5: API Response Shape Mismatch
- **Root Cause**: The React components accessed `post.username`, `post.profile_picture_url`, `comment.username`, and `comment.profile_picture_url`. However, the backend returned author data nested under `post.author.username` and `comment.author.username`, leaving frontend fields blank or broken.
- **Fix**: Added normalization helpers `formatPost` and `formatComment` to the backend to flatten author attributes to top-level properties while preserving nested structures. Additionally updated frontend components to defensively fallback to `post.author?.username` and default avatars.

### Bug 6: Insecure and Hardcoded Credentials
- **Root Cause**: Database credentials (`social_media_db`, `root`, `password`, `host`) and port configuration were hardcoded directly in `backend_express.js`.
- **Fix**: Replaced hardcoded values with `dotenv`-backed environment variables (`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN`). Created `.env.example` and `.env`, with `.env` kept securely in `.gitignore`.

### Bug 7: Inline Module Imports in Route Handlers
- **Root Cause**: `app.get('/api/trending')` executed `require('sequelize').Op.gte` inline, and `app.get('/api/search')` executed `const { Op } = require('sequelize')` inside the route callback.
- **Fix**: Extracted `Op` to the top-level imports: `const { Sequelize, DataTypes, Op } = require('sequelize');`.

### Bug 8: Missing Model Relationship for Likes on Comments
- **Root Cause**: In `schema.sql`, the `likes` table defines `FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE`. However, this relationship was omitted from the associations block.
- **Fix**: Added `Comment.hasMany(Like, { foreignKey: 'comment_id', as: 'likes' })` and `Like.belongsTo(Comment, { foreignKey: 'comment_id', as: 'comment' })`.

### Bug 9: Frontend Functionality and UX Gaps
- **Root Cause**: Frontend had a hardcoded `userId = 1`, no login or registration forms, no logout button, no post edit capability, no comment deletion, no unlike support, no image attachment in post creation, and unstyled raw components.
- **Fix**:
  - Implemented an interactive `AuthModal` for login and registration.
  - Added header with current user avatar, greeting, and logout action.
  - Implemented post image URL support in post creation.
  - Implemented post editing (`PUT /api/posts/:id`) and deletion (`DELETE /api/posts/:id`) with author permission checks.
  - Implemented full unlike support (`DELETE /api/posts/:id/unlike`) and like toggling.
  - Implemented comment deletion for comment authors (`DELETE /api/comments/:id`).
  - Added clickable author names to inspect any user's profile and posts.
  - Redesigned UI with modern CSS variables, cards, badges, and feedback alerts.

### Bug 10: Unbounded Feed Query (Scalability)
- **Root Cause**: `GET /api/posts` performed an unpaginated `findAll`, loading all posts and comment IDs into memory. With thousands of posts, this would cause severe database strain, high latency, and high memory usage.
- **Fix**: Implemented limit/offset pagination with `Post.findAndCountAll({ limit, offset, distinct: true })`. Added pagination metadata (`total`, `page`, `limit`, `totalPages`, `hasMore`) to the response, and added a "Load More Posts" button to the frontend feed.

---

## Part 3 — Code Quality & Production Readiness

### 11. API Design & Security Hardening
- **CORS Handling**: Configured native Express CORS middleware supporting preflight `OPTIONS` requests and configurable `CORS_ORIGIN`. Configured Vite proxy (`/api -> http://localhost:3000`) for seamless development.
- **Input Sanitization & Validation**: Added whitespace trimming, length validations (min 3 chars username, min 6 chars password), and email formatting checks.
- **Defensive Error Handling**: Centralized error middleware returning normalized JSON error messages and proper HTTP status codes (400, 401, 403, 404, 500).
- **Sensitive Data Exclusion**: Password hashes are stripped from all user queries via `attributes: { exclude: ['password_hash'] }`.

### 12. Performance & Query Optimization
- **Parallelized Query Execution**: In `GET /api/users/:id`, previously sequential counts were refactored to execute concurrently using `Promise.all([Post.count(...), Comment.count(...), Post.sum(...)])`.
- **Atomic Operations**: Like and unlike endpoints verify target post existence before creating or destroying records, preventing unhandled null reference crashes.
- **Optimized Includes**: Removed redundant includes that fetched full ID lists merely for count calculation.

### 13. Frontend Resilience & State Management
- **Graceful Error Handling**: Replaced silent console errors with user-visible alert banners.
- **Loading & Empty States**: Added visual indicators for feed loading, comment posting, and empty state cards for zero posts/search results.
- **Resilient Fallbacks**: Created fallback avatar generators using Robohash and UI avatars, preventing broken image placeholders.

### 14. Configuration & Multi-Environment Portability
- **Environment Parity**: All sensitive configurations are managed via environment variables. Default values ensure the app operates gracefully out-of-the-box in local development while allowing override in containerized or cloud environments (e.g. Docker, Kubernetes, AWS).
- **Graceful DB Degradation**: In environments without a running MySQL server, the backend catches connection failures and maintains server availability for health checks and static endpoints.

### 15. Architectural Blueprint for Scalability
In a production-scale application, the monolithic single-file structure should be modularized into standard layers:
```
backend/
├── src/
│   ├── config/          # Database, JWT, environment configs
│   ├── models/          # User.js, Post.js, Comment.js, Like.js
│   ├── middleware/      # auth.js, errorHandler.js, rateLimiter.js
│   ├── controllers/     # authController.js, postController.js, userController.js
│   ├── routes/          # authRoutes.js, postRoutes.js, userRoutes.js
│   └── app.js           # Express app setup and server entrypoint
frontend/
├── src/
│   ├── api/             # Axios client and API service wrappers
│   ├── components/      # PostCard, CommentSection, AuthModal, Header
│   ├── pages/           # FeedPage, ProfilePage, TrendingPage, SearchPage
│   ├── hooks/           # useAuth, useFeed, usePosts
│   └── App.jsx
```

---

## Verification & Testing

An automated verification test suite has been added in `test_app.js` and wired to `npm test`:

```bash
npm test
```

### Test Results:
- **45 automated tests passed**, covering:
  - All model attributes and column types
  - All 12 entity associations
  - Protected route security (401 on missing auth, 403 on invalid tokens)
  - Payload validation on login, registration, and search
  - CORS preflight and header verification
- **Frontend build test (`npx vite build`)**: Completed with 0 errors.
