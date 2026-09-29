// ============================================================================
// AUTOMATED TEST SUITE: Full-stack Social Media App
// Validates Models, Associations, Authentication, Route Protections, and Response Shapes
// ============================================================================

const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('./backend_express.js');
const { User, Post, Comment, Like } = app;

async function runTests() {
    console.log('🧪 Starting Fullstack Social Media App Verification Tests...\n');
    let passed = 0;
    let failed = 0;

    const assert = (condition, description) => {
        if (condition) {
            console.log(`  ✓ ${description}`);
            passed++;
        } else {
            console.error(`  ✗ FAIL: ${description}`);
            failed++;
        }
    };

    // -------------------------------------------------------------------------
    // 1. Models & Attributes Verification (Part 1)
    // -------------------------------------------------------------------------
    console.log('--- 1. Models & Attributes Verification ---');
    const userAttrs = Object.keys(User.rawAttributes);
    assert(userAttrs.includes('id'), 'User has primary key id');
    assert(userAttrs.includes('username'), 'User has username');
    assert(userAttrs.includes('email'), 'User has email');
    assert(userAttrs.includes('password_hash'), 'User has password_hash');
    assert(userAttrs.includes('profile_picture_url'), 'User has profile_picture_url');
    assert(userAttrs.includes('bio'), 'User has bio');

    const postAttrs = Object.keys(Post.rawAttributes);
    assert(postAttrs.includes('id'), 'Post has primary key id');
    assert(postAttrs.includes('user_id'), 'Post has user_id foreign key');
    assert(postAttrs.includes('title'), 'Post has title');
    assert(postAttrs.includes('content'), 'Post has content');
    assert(postAttrs.includes('image_url'), 'Post has image_url');
    assert(postAttrs.includes('likes_count'), 'Post has likes_count');

    const commentAttrs = Object.keys(Comment.rawAttributes);
    assert(commentAttrs.includes('id'), 'Comment has primary key id');
    assert(commentAttrs.includes('post_id'), 'Comment has post_id foreign key');
    assert(commentAttrs.includes('user_id'), 'Comment has user_id foreign key');
    assert(commentAttrs.includes('content'), 'Comment has content');
    assert(commentAttrs.includes('likes_count'), 'Comment has likes_count');

    const likeAttrs = Object.keys(Like.rawAttributes);
    assert(likeAttrs.includes('id'), 'Like has primary key id');
    assert(likeAttrs.includes('user_id'), 'Like has user_id foreign key');
    assert(likeAttrs.includes('post_id'), 'Like has post_id foreign key');
    assert(likeAttrs.includes('comment_id'), 'Like has comment_id foreign key (Bug 8)');

    // -------------------------------------------------------------------------
    // 2. Associations Verification (Part 1 & Bug 8)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Associations Verification ---');
    assert(User.associations.posts !== undefined, 'User -> Post association (posts)');
    assert(User.associations.comments !== undefined, 'User -> Comment association (comments)');
    assert(User.associations.likes !== undefined, 'User -> Like association (likes)');

    assert(Post.associations.author !== undefined, 'Post -> User association (author)');
    assert(Post.associations.comments !== undefined, 'Post -> Comment association (comments)');
    assert(Post.associations.likes !== undefined, 'Post -> Like association (likes)');

    assert(Comment.associations.author !== undefined, 'Comment -> User association (author)');
    assert(Comment.associations.post !== undefined, 'Comment -> Post association (post)');
    assert(Comment.associations.likes !== undefined, 'Comment -> Like association (likes - Bug 8)');

    assert(Like.associations.user !== undefined, 'Like -> User association (user)');
    assert(Like.associations.post !== undefined, 'Like -> Post association (post)');
    assert(Like.associations.comment !== undefined, 'Like -> Comment association (comment - Bug 8)');

    // -------------------------------------------------------------------------
    // 3. HTTP Endpoints & Security Verification (Part 2)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. HTTP Endpoints & Route Security ---');
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    try {
        // Bug 1 & 2: Protected routes enforce authentication and avoid runtime crashes
        const unauthPost = await fetch(`${baseUrl}/api/posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Test Post', content: 'Test Content' })
        });
        assert(unauthPost.status === 401, 'POST /api/posts rejects unauthenticated request with 401');

        const invalidTokenRes = await fetch(`${baseUrl}/api/posts`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer bad_token_12345'
            },
            body: JSON.stringify({ title: 'Test Post', content: 'Test Content' })
        });
        assert(invalidTokenRes.status === 403, 'Protected route rejects invalid token with 403');

        const unauthPut = await fetch(`${baseUrl}/api/posts/1`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Updated Title' })
        });
        assert(unauthPut.status === 401, 'PUT /api/posts/:id rejects unauthenticated request with 401');

        const unauthDelete = await fetch(`${baseUrl}/api/posts/1`, { method: 'DELETE' });
        assert(unauthDelete.status === 401, 'DELETE /api/posts/:id rejects unauthenticated request with 401');

        const unauthComment = await fetch(`${baseUrl}/api/posts/1/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 'Test comment' })
        });
        assert(unauthComment.status === 401, 'POST /api/posts/:postId/comments rejects unauthenticated request with 401');

        const unauthDeleteComment = await fetch(`${baseUrl}/api/comments/1`, { method: 'DELETE' });
        assert(unauthDeleteComment.status === 401, 'DELETE /api/comments/:id rejects unauthenticated request with 401');

        const unauthLike = await fetch(`${baseUrl}/api/posts/1/like`, { method: 'POST' });
        assert(unauthLike.status === 401, 'POST /api/posts/:postId/like rejects unauthenticated request with 401');

        const unauthUnlike = await fetch(`${baseUrl}/api/posts/1/unlike`, { method: 'DELETE' });
        assert(unauthUnlike.status === 401, 'DELETE /api/posts/:postId/unlike rejects unauthenticated request with 401');

        // Bug 3: Login route exists and validates payload
        const emptyLogin = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        assert(emptyLogin.status === 400, 'POST /api/login rejects empty payload with 400');

        // Validation for search
        const emptySearch = await fetch(`${baseUrl}/api/search`);
        assert(emptySearch.status === 400, 'GET /api/search rejects empty query with 400');

        // CORS headers check
        const corsRes = await fetch(`${baseUrl}/api/posts`, { method: 'OPTIONS' });
        assert(corsRes.status === 204, 'OPTIONS preflight returns 204');
        assert(corsRes.headers.get('access-control-allow-origin') !== null, 'CORS headers are present');

        console.log(`\n🎉 Verification Complete: ${passed} passed, ${failed} failed.\n`);
    } finally {
        server.close();
    }

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Test runner encountered unexpected error:', err);
    process.exit(1);
});
