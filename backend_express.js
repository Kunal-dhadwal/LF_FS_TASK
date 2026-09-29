// ============================================================================
// BACKEND: Node.js + Express + Sequelize ORM
// ============================================================================

const express = require('express');
const { Sequelize, DataTypes, Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS for frontend integration across environments
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

// ============================================================================
// DATABASE CONNECTION
// Configured securely via environment variables (Part 2 - Bug 6, Part 3 - Point 14)
// ============================================================================

const DB_NAME = process.env.DB_NAME || 'social_media_db';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'password';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT, 10) || 3306;
const DB_DIALECT = process.env.DB_DIALECT || 'mysql';
const JWT_SECRET = process.env.JWT_SECRET || 'social_media_jwt_secret_key_change_in_production_2026';

const sequelize = DB_DIALECT === 'sqlite'
    ? new Sequelize({
        dialect: 'sqlite',
        storage: process.env.DB_STORAGE || ':memory:',
        logging: process.env.NODE_ENV === 'development' ? console.log : false
    })
    : new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
        host: DB_HOST,
        port: DB_PORT,
        dialect: 'mysql',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    });

// Test database connection
sequelize.authenticate()
    .then(() => console.log('✓ Database connected'))
    .catch(err => console.error('✗ Database connection failed:', err.message));

// ============================================================================
// MODEL DEFINITIONS
// Defined based on schema.sql (Part 1 - Models)
// ============================================================================

// 1. Users Model
const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: { isEmail: true }
    },
    password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    profile_picture_url: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    bio: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, { 
    tableName: 'users', 
    timestamps: true, 
    underscored: true 
});

// 2. Posts Model
const Post = sequelize.define('Post', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    title: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    image_url: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    likes_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, { 
    tableName: 'posts', 
    timestamps: true, 
    underscored: true 
});

// 3. Comments Model
const Comment = sequelize.define('Comment', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    post_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    likes_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, { 
    tableName: 'comments', 
    timestamps: true, 
    underscored: true 
});

// 4. Likes Model
const Like = sequelize.define('Like', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    post_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    comment_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, { 
    tableName: 'likes', 
    timestamps: true, 
    updatedAt: false, // likes table in schema.sql only tracks created_at
    underscored: true 
});

// ============================================================================
// ASSOCIATIONS
// Wired up based on schema.sql foreign keys (Part 1 - Associations, Part 2 - Bug 8)
// ============================================================================

// User <-> Post
User.hasMany(Post, { foreignKey: 'user_id', as: 'posts', onDelete: 'CASCADE' });
Post.belongsTo(User, { foreignKey: 'user_id', as: 'author' });

// User <-> Comment
User.hasMany(Comment, { foreignKey: 'user_id', as: 'comments', onDelete: 'CASCADE' });
Comment.belongsTo(User, { foreignKey: 'user_id', as: 'author' });

// Post <-> Comment
Post.hasMany(Comment, { foreignKey: 'post_id', as: 'comments', onDelete: 'CASCADE' });
Comment.belongsTo(Post, { foreignKey: 'post_id', as: 'post' });

// User <-> Like
User.hasMany(Like, { foreignKey: 'user_id', as: 'likes', onDelete: 'CASCADE' });
Like.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Post <-> Like
Post.hasMany(Like, { foreignKey: 'post_id', as: 'likes', onDelete: 'CASCADE' });
Like.belongsTo(Post, { foreignKey: 'post_id', as: 'post' });

// Comment <-> Like (Bug 8: comment_id foreign key on likes table)
Comment.hasMany(Like, { foreignKey: 'comment_id', as: 'likes', onDelete: 'CASCADE' });
Like.belongsTo(Comment, { foreignKey: 'comment_id', as: 'comment' });

// ============================================================================
// RESPONSE FORMATTING HELPERS
// Normalizes database entities to match frontend expectations (Part 2 - Bug 5)
// ============================================================================

const formatPost = (post) => {
    const postJson = typeof post.toJSON === 'function' ? post.toJSON() : post;
    const author = postJson.author || {};
    const comments = postJson.comments || [];
    return {
        ...postJson,
        username: author.username || postJson.username || 'Anonymous',
        profile_picture_url: author.profile_picture_url || postJson.profile_picture_url || `https://robohash.org/${postJson.user_id || 1}`,
        comment_count: postJson.comment_count !== undefined ? postJson.comment_count : comments.length
    };
};

const formatComment = (comment) => {
    const commentJson = typeof comment.toJSON === 'function' ? comment.toJSON() : comment;
    const author = commentJson.author || {};
    return {
        ...commentJson,
        username: author.username || commentJson.username || 'Anonymous',
        profile_picture_url: author.profile_picture_url || commentJson.profile_picture_url || `https://robohash.org/${commentJson.user_id || 1}`
    };
};

// ============================================================================
// MIDDLEWARE
// JWT Authentication & Central Error Handling (Part 2 - Bug 1 & Bug 2)
// ============================================================================

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && (authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader);

    if (!token) {
        return res.status(401).json({ error: 'Access token required. Please log in.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = decodedUser;
        next();
    });
};

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
};

// ============================================================================
// AUTH & USER ENDPOINTS (Part 2 - Bug 3)
// ============================================================================

// POST login - Authenticate user and issue JWT token
app.post('/api/login', async (req, res, next) => {
    try {
        const { email, username, password } = req.body;

        if ((!email && !username) || !password) {
            return res.status(400).json({ error: 'Email (or username) and password required' });
        }

        const whereClause = email ? { email } : { username };
        const user = await User.findOne({ where: whereClause });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Support bcrypt hashes as well as legacy sha256 hashes from insert_data.sql
        let isMatch = false;
        if (user.password_hash.startsWith('$2')) {
            isMatch = await bcrypt.compare(password, user.password_hash);
        } else {
            const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
            isMatch = (user.password_hash === sha256Hash || user.password_hash === password);
        }

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                profile_picture_url: user.profile_picture_url || `https://robohash.org/${user.id}`,
                bio: user.bio
            }
        });
    } catch (error) {
        next(error);
    }
});

// GET current authenticated user profile
app.get('/api/auth/me', authenticateToken, async (req, res, next) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['password_hash'] }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        next(error);
    }
});

// GET all users
app.get('/api/users', async (req, res, next) => {
    try {
        const users = await User.findAll({
            attributes: { exclude: ['password_hash'] },
            limit: 100
        });
        res.json(users);
    } catch (error) {
        next(error);
    }
});

// GET user by ID with stats (Part 2 - Bug 4 fix: removed erroneous 'through' option)
app.get('/api/users/:id', async (req, res, next) => {
    try {
        const user = await User.findByPk(req.params.id, {
            attributes: { exclude: ['password_hash'] },
            include: [
                {
                    model: Post,
                    as: 'posts',
                    attributes: ['id', 'title', 'content', 'likes_count', 'created_at'],
                    limit: 10,
                    order: [['created_at', 'DESC']]
                }
            ]
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        // Calculate stats concurrently for maximum efficiency (Part 3 - Point 12)
        const [postsCount, commentsCount, postsLikes] = await Promise.all([
            Post.count({ where: { user_id: user.id } }),
            Comment.count({ where: { user_id: user.id } }),
            Post.sum('likes_count', { where: { user_id: user.id } })
        ]);

        res.json({
            ...user.toJSON(),
            total_posts: postsCount || 0,
            total_comments: commentsCount || 0,
            total_post_likes: postsLikes || 0
        });
    } catch (error) {
        next(error);
    }
});

// CREATE user / Register
app.post('/api/users', async (req, res, next) => {
    try {
        const { username, email, password, bio, profile_picture_url } = req.body;

        // Validate required fields
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password required' });
        }

        if (username.trim().length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if user exists
        const exists = await User.findOne({
            where: {
                [Op.or]: [{ email }, { username }]
            }
        });
        if (exists) {
            return res.status(400).json({
                error: exists.email === email ? 'Email already registered' : 'Username already taken'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            username: username.trim(),
            email: email.trim().toLowerCase(),
            password_hash: hashedPassword,
            profile_picture_url: profile_picture_url || `https://robohash.org/${encodeURIComponent(username.trim())}`,
            bio: bio ? bio.trim() : ''
        });

        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Registration successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                profile_picture_url: user.profile_picture_url,
                bio: user.bio
            }
        });
    } catch (error) {
        next(error);
    }
});

// ============================================================================
// POST ENDPOINTS (Part 2 - Bug 2: Protected with authenticateToken, Bug 5: Response shape, Bug 10: Pagination)
// ============================================================================

// GET feed (Paginated for production scalability - Bug 10)
app.get('/api/posts', async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const offset = (page - 1) * limit;

        const { count, rows } = await Post.findAndCountAll({
            include: [
                {
                    model: User,
                    as: 'author',
                    attributes: ['id', 'username', 'profile_picture_url']
                },
                {
                    model: Comment,
                    as: 'comments',
                    attributes: ['id']
                }
            ],
            distinct: true,
            order: [['created_at', 'DESC']],
            limit,
            offset
        });

        const posts = rows.map(post => formatPost(post));

        res.json({
            posts,
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit),
                hasMore: offset + rows.length < count
            }
        });
    } catch (error) {
        next(error);
    }
});

// GET post by ID with comments (Bug 5: Normalized fields)
app.get('/api/posts/:id', async (req, res, next) => {
    try {
        const post = await Post.findByPk(req.params.id, {
            include: [
                {
                    model: User,
                    as: 'author',
                    attributes: ['id', 'username', 'profile_picture_url']
                },
                {
                    model: Comment,
                    as: 'comments',
                    include: [
                        {
                            model: User,
                            as: 'author',
                            attributes: ['id', 'username', 'profile_picture_url']
                        }
                    ]
                }
            ],
            order: [[{ model: Comment, as: 'comments' }, 'created_at', 'DESC']]
        });

        if (!post) return res.status(404).json({ error: 'Post not found' });

        const formatted = formatPost(post);
        formatted.comments = (post.comments || []).map(comment => formatComment(comment));

        res.json(formatted);
    } catch (error) {
        next(error);
    }
});

// CREATE post (Protected - Bug 2)
app.post('/api/posts', authenticateToken, async (req, res, next) => {
    try {
        const { title, content, image_url } = req.body;

        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content required' });
        }

        const post = await Post.create({
            user_id: req.user.id,
            title: title.trim(),
            content: content.trim(),
            image_url: image_url ? image_url.trim() : null
        });

        // Retrieve post with author details for immediate UI rendering
        const createdPost = await Post.findByPk(post.id, {
            include: [{ model: User, as: 'author', attributes: ['id', 'username', 'profile_picture_url'] }]
        });

        res.status(201).json(formatPost(createdPost));
    } catch (error) {
        next(error);
    }
});

// UPDATE post (Protected - Bug 2)
app.put('/api/posts/:id', authenticateToken, async (req, res, next) => {
    try {
        const post = await Post.findByPk(req.params.id);

        if (!post) return res.status(404).json({ error: 'Post not found' });
        if (post.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to edit this post' });
        }

        await post.update({
            title: req.body.title !== undefined ? req.body.title.trim() : post.title,
            content: req.body.content !== undefined ? req.body.content.trim() : post.content,
            image_url: req.body.image_url !== undefined ? (req.body.image_url ? req.body.image_url.trim() : null) : post.image_url
        });

        const updatedPost = await Post.findByPk(post.id, {
            include: [{ model: User, as: 'author', attributes: ['id', 'username', 'profile_picture_url'] }]
        });

        res.json({
            message: 'Post updated',
            post: formatPost(updatedPost)
        });
    } catch (error) {
        next(error);
    }
});

// DELETE post (Protected - Bug 2)
app.delete('/api/posts/:id', authenticateToken, async (req, res, next) => {
    try {
        const post = await Post.findByPk(req.params.id);

        if (!post) return res.status(404).json({ error: 'Post not found' });
        if (post.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to delete this post' });
        }

        await post.destroy();
        res.json({ message: 'Post deleted' });
    } catch (error) {
        next(error);
    }
});

// ============================================================================
// COMMENT ENDPOINTS (Part 2 - Bug 2: Protected, Bug 5: Response shape)
// ============================================================================

// CREATE comment (Protected - Bug 2)
app.post('/api/posts/:postId/comments', authenticateToken, async (req, res, next) => {
    try {
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Content required' });
        }

        const post = await Post.findByPk(req.params.postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const comment = await Comment.create({
            post_id: req.params.postId,
            user_id: req.user.id,
            content: content.trim()
        });

        const fullComment = await Comment.findByPk(comment.id, {
            include: [
                {
                    model: User,
                    as: 'author',
                    attributes: ['id', 'username', 'profile_picture_url']
                }
            ]
        });

        res.status(201).json(formatComment(fullComment));
    } catch (error) {
        next(error);
    }
});

// GET comments for post (Bug 5: Normalized fields)
app.get('/api/posts/:postId/comments', async (req, res, next) => {
    try {
        const comments = await Comment.findAll({
            where: { post_id: req.params.postId },
            include: [
                {
                    model: User,
                    as: 'author',
                    attributes: ['id', 'username', 'profile_picture_url']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        res.json(comments.map(c => formatComment(c)));
    } catch (error) {
        next(error);
    }
});

// DELETE comment (Protected - Bug 2)
app.delete('/api/comments/:id', authenticateToken, async (req, res, next) => {
    try {
        const comment = await Comment.findByPk(req.params.id);

        if (!comment) return res.status(404).json({ error: 'Comment not found' });
        if (comment.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to delete this comment' });
        }

        await comment.destroy();
        res.json({ message: 'Comment deleted' });
    } catch (error) {
        next(error);
    }
});

// ============================================================================
// LIKE ENDPOINTS (Part 2 - Bug 2: Protected with authenticateToken, atomic checks)
// ============================================================================

// LIKE a post (Protected - Bug 2)
app.post('/api/posts/:postId/like', authenticateToken, async (req, res, next) => {
    try {
        const post = await Post.findByPk(req.params.postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Check if already liked
        const existingLike = await Like.findOne({
            where: {
                user_id: req.user.id,
                post_id: req.params.postId,
                comment_id: null
            }
        });

        if (existingLike) {
            return res.status(400).json({ error: 'Already liked' });
        }

        // Add like
        await Like.create({
            user_id: req.user.id,
            post_id: req.params.postId
        });

        // Atomically increment post likes count
        await post.increment('likes_count');
        await post.reload();

        res.status(201).json({ 
            message: 'Post liked',
            likes_count: post.likes_count
        });
    } catch (error) {
        next(error);
    }
});

// UNLIKE a post (Protected - Bug 2)
app.delete('/api/posts/:postId/unlike', authenticateToken, async (req, res, next) => {
    try {
        const post = await Post.findByPk(req.params.postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const like = await Like.findOne({
            where: {
                user_id: req.user.id,
                post_id: req.params.postId,
                comment_id: null
            }
        });

        if (!like) return res.status(404).json({ error: 'Like not found' });

        await like.destroy();

        if (post.likes_count > 0) {
            await post.decrement('likes_count');
            await post.reload();
        }

        res.json({ 
            message: 'Post unliked',
            likes_count: post.likes_count
        });
    } catch (error) {
        next(error);
    }
});

// ============================================================================
// TRENDING ENDPOINT
// Part 2 - Bug 5: Response shape, Bug 7: Clean top-level Op import
// ============================================================================

app.get('/api/trending', async (req, res, next) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const posts = await Post.findAll({
            where: {
                created_at: { [Op.gte]: sevenDaysAgo }
            },
            include: [
                {
                    model: User,
                    as: 'author',
                    attributes: ['id', 'username', 'profile_picture_url']
                },
                {
                    model: Comment,
                    as: 'comments',
                    attributes: ['id']
                }
            ],
            order: [['likes_count', 'DESC']],
            limit: 20
        });

        const result = posts.map(post => formatPost(post));
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// ============================================================================
// SEARCH ENDPOINT
// Part 2 - Bug 5: Response shape, Bug 7: Clean top-level Op import
// ============================================================================

app.get('/api/search', async (req, res, next) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length === 0) {
            return res.status(400).json({ error: 'Search query required' });
        }

        const trimmed = q.trim();

        const posts = await Post.findAll({
            where: {
                [Op.or]: [
                    { title: { [Op.like]: `%${trimmed}%` } },
                    { content: { [Op.like]: `%${trimmed}%` } }
                ]
            },
            include: [
                {
                    model: User,
                    as: 'author',
                    attributes: ['id', 'username', 'profile_picture_url']
                },
                {
                    model: Comment,
                    as: 'comments',
                    attributes: ['id']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: 20
        });

        res.json(posts.map(post => formatPost(post)));
    } catch (error) {
        next(error);
    }
});

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

app.use(errorHandler);

// ============================================================================
// SYNC DATABASE AND START SERVER
// ============================================================================

const PORT = parseInt(process.env.PORT, 10) || 3000;

// Auto-start server when run directly
if (require.main === module) {
    sequelize.sync({ alter: false })
        .then(() => {
            app.listen(PORT, () => {
                console.log(`✓ Server running on http://localhost:${PORT}`);
            });
        })
        .catch(err => {
            console.error('✗ Failed to sync database:', err.message);
            // In degraded mode without live database, server still binds so health checks work
            app.listen(PORT, () => {
                console.log(`! Server running in offline/degraded mode on http://localhost:${PORT}`);
            });
        });
}

// Export app and models for modularity and automated testing (Part 3 - Point 15)
app.sequelize = sequelize;
app.User = User;
app.Post = Post;
app.Comment = Comment;
app.Like = Like;

module.exports = app;
