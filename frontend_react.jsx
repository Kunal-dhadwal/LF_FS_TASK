// ============================================================================
// FRONTEND: React Social Media App
// Production-grade implementation addressing Bug 5, Bug 9, and Part 3 requirements
// ============================================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Configurable API URL with Vite proxy fallback (Part 3 - Point 14)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Helper for default user avatars
const getAvatarUrl = (user, seed) => {
    if (user && user.profile_picture_url) return user.profile_picture_url;
    const name = (user && (user.username || user.email)) || seed || 'user';
    return `https://robohash.org/${encodeURIComponent(name)}?set=set4&size=80x80`;
};

// ============================================================================
// 1. AUTH MODAL / COMPONENT (Part 2 - Bug 3, Bug 9)
// ============================================================================
const AuthModal = ({ isOpen, onClose, onAuthSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        bio: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const endpoint = isLogin ? `${API_BASE_URL}/login` : `${API_BASE_URL}/users`;
            const payload = isLogin
                ? { email: formData.email, password: formData.password }
                : { 
                    username: formData.username, 
                    email: formData.email, 
                    password: formData.password, 
                    bio: formData.bio 
                };

            const response = await axios.post(endpoint, payload);
            const { token, user } = response.data;

            if (token && user) {
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(user));
                onAuthSuccess(user, token);
                onClose();
            } else {
                setError('Unexpected authentication response');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Authentication failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{isLogin ? 'Welcome Back' : 'Create an Account'}</h3>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    {!isLogin && (
                        <div className="form-group">
                            <label>Username</label>
                            <input
                                type="text"
                                placeholder="Choose a username"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                required
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label>{isLogin ? 'Email or Username' : 'Email'}</label>
                        <input
                            type="text"
                            placeholder="your.email@example.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required
                        />
                    </div>

                    {!isLogin && (
                        <div className="form-group">
                            <label>Bio (optional)</label>
                            <textarea
                                placeholder="Tell us a bit about yourself..."
                                value={formData.bio}
                                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                rows={2}
                            />
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                        {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
                    </button>
                </form>

                <div className="modal-footer">
                    <p>
                        {isLogin ? "Don't have an account? " : "Already have an account? "}
                        <button 
                            type="button" 
                            className="link-btn" 
                            onClick={() => { setIsLogin(!isLogin); setError(''); }}
                        >
                            {isLogin ? 'Register now' : 'Log in here'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// 2. USER PROFILE COMPONENT (Part 2 - Bug 4, Bug 5, Bug 9)
// ============================================================================
const UserProfile = ({ userId, onSelectUser }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!userId) return;
        fetchUserProfile();
    }, [userId]);

    const fetchUserProfile = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(`${API_BASE_URL}/users/${userId}`);
            setUser(response.data);
        } catch (err) {
            console.error('Error fetching user:', err);
            setError(err.response?.data?.error || 'Failed to load user profile');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading-spinner">Loading profile...</div>;
    if (error) return <div className="alert alert-error">{error}</div>;
    if (!user) return <div className="empty-state">User not found</div>;

    const avatar = getAvatarUrl(user, user.username);

    return (
        <div className="user-profile card">
            <div className="profile-header">
                <img 
                    src={avatar} 
                    alt={user.username} 
                    className="avatar-large" 
                    onError={(e) => { e.target.src = `https://robohash.org/${user.id}?set=set4`; }}
                />
                <div className="profile-details">
                    <h2>@{user.username}</h2>
                    <p className="profile-email">{user.email}</p>
                    {user.bio ? <p className="profile-bio">{user.bio}</p> : <p className="profile-bio-empty">No bio provided</p>}
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <span className="stat-number">{user.total_posts || 0}</span>
                    <span className="stat-label">Posts</span>
                </div>
                <div className="stat-card">
                    <span className="stat-number">{user.total_comments || 0}</span>
                    <span className="stat-label">Comments</span>
                </div>
                <div className="stat-card">
                    <span className="stat-number">{user.total_post_likes || 0}</span>
                    <span className="stat-label">Post Likes</span>
                </div>
            </div>

            {user.posts && user.posts.length > 0 && (
                <div className="user-recent-posts">
                    <h3>Recent Posts</h3>
                    <div className="recent-posts-list">
                        {user.posts.map(p => (
                            <div key={p.id} className="recent-post-item">
                                <strong>{p.title}</strong>
                                <p>{p.content ? p.content.slice(0, 120) + (p.content.length > 120 ? '...' : '') : ''}</p>
                                <small>❤️ {p.likes_count} likes</small>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// 3. POST COMPONENT (Part 2 - Bug 2, Bug 5, Bug 9)
// ============================================================================
const Post = ({ post, onLikeToggle, onDelete, onUpdate, currentUserId, onSelectUser, onRequireAuth }) => {
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(post.title || '');
    const [editContent, setEditContent] = useState(post.content || '');
    const [editImage, setEditImage] = useState(post.image_url || '');
    const [commentError, setCommentError] = useState('');

    const token = localStorage.getItem('token');
    const isAuthor = currentUserId && (currentUserId === post.user_id || currentUserId === post.author?.id);

    const fetchComments = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/posts/${post.id}/comments`);
            setComments(response.data);
        } catch (error) {
            console.error('Error fetching comments:', error);
        }
    };

    const handleShowComments = () => {
        if (!showComments) {
            fetchComments();
        }
        setShowComments(!showComments);
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        if (!token) {
            onRequireAuth();
            return;
        }

        setSubmittingComment(true);
        setCommentError('');
        try {
            const response = await axios.post(
                `${API_BASE_URL}/posts/${post.id}/comments`,
                { content: newComment.trim() },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setNewComment('');
            setComments([response.data, ...comments]);
            if (post.comment_count !== undefined) {
                post.comment_count += 1;
            }
        } catch (error) {
            setCommentError(error.response?.data?.error || 'Failed to post comment');
        } finally {
            setSubmittingComment(false);
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!token) {
            onRequireAuth();
            return;
        }

        try {
            await axios.delete(`${API_BASE_URL}/comments/${commentId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setComments(comments.filter(c => c.id !== commentId));
            if (post.comment_count && post.comment_count > 0) {
                post.comment_count -= 1;
            }
        } catch (error) {
            console.error('Error deleting comment:', error);
        }
    };

    const handleSaveEdit = async () => {
        if (!token) {
            onRequireAuth();
            return;
        }

        try {
            await onUpdate(post.id, {
                title: editTitle,
                content: editContent,
                image_url: editImage
            });
            setIsEditing(false);
        } catch (err) {
            console.error('Error saving post edit:', err);
        }
    };

    // Normalized author fields (Bug 5)
    const authorUsername = post.username || post.author?.username || 'Anonymous';
    const authorAvatar = post.profile_picture_url || post.author?.profile_picture_url || getAvatarUrl(null, authorUsername);
    const postUserId = post.user_id || post.author?.id;

    return (
        <div className="post card">
            <div className="post-header">
                <img 
                    src={authorAvatar} 
                    alt={authorUsername} 
                    className="avatar-small"
                    onClick={() => postUserId && onSelectUser && onSelectUser(postUserId)}
                    onError={(e) => { e.target.src = `https://robohash.org/${post.id}?set=set4`; }}
                />
                <div className="post-meta">
                    <strong 
                        className="author-name"
                        onClick={() => postUserId && onSelectUser && onSelectUser(postUserId)}
                    >
                        @{authorUsername}
                    </strong>
                    <small className="post-date">
                        {post.created_at ? new Date(post.created_at).toLocaleDateString(undefined, { 
                            month: 'short', day: 'numeric', year: 'numeric' 
                        }) : 'Recent'}
                    </small>
                </div>
            </div>

            {isEditing ? (
                <div className="edit-post-form">
                    <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Post title"
                        className="form-control"
                    />
                    <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        placeholder="Post content"
                        rows={3}
                        className="form-control"
                    />
                    <input
                        type="url"
                        value={editImage}
                        onChange={(e) => setEditImage(e.target.value)}
                        placeholder="Image URL (optional)"
                        className="form-control"
                    />
                    <div className="edit-actions">
                        <button className="btn btn-sm btn-primary" onClick={handleSaveEdit}>Save</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
                    </div>
                </div>
            ) : (
                <>
                    <h3 className="post-title">{post.title}</h3>
                    <p className="post-content">{post.content}</p>
                    {post.image_url && (
                        <div className="post-image-container">
                            <img src={post.image_url} alt="Post Attachment" className="post-image" />
                        </div>
                    )}
                </>
            )}

            <div className="post-stats">
                <button 
                    className="stat-btn like-btn"
                    onClick={() => onLikeToggle(post.id)}
                    title="Like / Unlike"
                >
                    ❤️ <span>{post.likes_count || 0}</span>
                </button>
                <button 
                    className="stat-btn comment-btn" 
                    onClick={handleShowComments}
                    title="Comments"
                >
                    💬 <span>{post.comment_count !== undefined ? post.comment_count : comments.length}</span>
                </button>
                {isAuthor && !isEditing && (
                    <div className="author-actions">
                        <button className="btn btn-sm btn-outline" onClick={() => setIsEditing(true)}>✏️ Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => onDelete(post.id)}>🗑️ Delete</button>
                    </div>
                )}
            </div>

            {showComments && (
                <div className="comments-section">
                    <form className="add-comment-form" onSubmit={handleAddComment}>
                        <input
                            type="text"
                            placeholder={token ? "Write a comment..." : "Log in to join the conversation..."}
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            disabled={submittingComment}
                        />
                        <button 
                            type="submit" 
                            className="btn btn-primary btn-sm" 
                            disabled={submittingComment || !newComment.trim()}
                        >
                            {submittingComment ? '...' : 'Reply'}
                        </button>
                    </form>
                    {commentError && <div className="alert alert-error">{commentError}</div>}

                    <div className="comments-list">
                        {comments.length === 0 ? (
                            <p className="no-comments">No comments yet. Be the first to reply!</p>
                        ) : (
                            comments.map(comment => {
                                const cAuthor = comment.username || comment.author?.username || 'Anonymous';
                                const cAvatar = comment.profile_picture_url || comment.author?.profile_picture_url || getAvatarUrl(null, cAuthor);
                                const isCommentAuthor = currentUserId && (currentUserId === comment.user_id || currentUserId === comment.author?.id);

                                return (
                                    <div key={comment.id} className="comment-item">
                                        <img 
                                            src={cAvatar} 
                                            alt={cAuthor} 
                                            className="avatar-xs"
                                            onClick={() => comment.user_id && onSelectUser && onSelectUser(comment.user_id)}
                                            onError={(e) => { e.target.src = `https://robohash.org/${comment.id}?set=set4`; }}
                                        />
                                        <div className="comment-bubble">
                                            <div className="comment-bubble-header">
                                                <strong onClick={() => comment.user_id && onSelectUser && onSelectUser(comment.user_id)}>
                                                    @{cAuthor}
                                                </strong>
                                                {isCommentAuthor && (
                                                    <button 
                                                        className="comment-delete-btn"
                                                        onClick={() => handleDeleteComment(comment.id)}
                                                        title="Delete comment"
                                                    >
                                                        &times;
                                                    </button>
                                                )}
                                            </div>
                                            <p className="comment-text">{comment.content}</p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// 4. CREATE POST COMPONENT (Part 2 - Bug 9: added image_url & better UX)
// ============================================================================
const CreatePost = ({ onPostCreated, onRequireAuth }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const token = localStorage.getItem('token');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!token) {
            onRequireAuth();
            return;
        }

        if (!title.trim() || !content.trim()) {
            setError('Please provide both a title and content for your post.');
            return;
        }

        setLoading(true);
        try {
            await axios.post(
                `${API_BASE_URL}/posts`,
                { 
                    title: title.trim(), 
                    content: content.trim(), 
                    image_url: imageUrl.trim() || null 
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setTitle('');
            setContent('');
            setImageUrl('');
            onPostCreated();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create post. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-post card">
            <h3>Create a Post</h3>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder="Give your post an engaging title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="form-control"
                />
                <textarea
                    placeholder="Share what is happening..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                    rows={3}
                    className="form-control"
                />
                <input
                    type="url"
                    placeholder="Image URL (optional, e.g. https://picsum.photos/400/250)"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="form-control"
                />
                <div className="create-post-footer">
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Publishing...' : '✨ Publish Post'}
                    </button>
                </div>
            </form>
        </div>
    );
};

// ============================================================================
// 5. FEED COMPONENT (Part 2 - Bug 10: Pagination Support)
// ============================================================================
const Feed = ({ currentUserId, onSelectUser, onRequireAuth }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [likedPosts, setLikedPosts] = useState(new Set());

    useEffect(() => {
        fetchFeed(1, false);
    }, []);

    const fetchFeed = async (pageNumber = 1, append = false) => {
        try {
            if (!append) setLoading(true);
            else setLoadingMore(true);

            const response = await axios.get(`${API_BASE_URL}/posts`, {
                params: { page: pageNumber, limit: 10 }
            });

            const newPosts = response.data.posts || [];
            const pagination = response.data.pagination || {};

            if (append) {
                setPosts(prev => [...prev, ...newPosts]);
            } else {
                setPosts(newPosts);
            }

            setPage(pageNumber);
            setHasMore(Boolean(pagination.hasMore));
        } catch (error) {
            console.error('Error fetching feed:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const handleLikeToggle = async (postId) => {
        const token = localStorage.getItem('token');
        if (!token) {
            onRequireAuth();
            return;
        }

        const isCurrentlyLiked = likedPosts.has(postId);
        try {
            if (isCurrentlyLiked) {
                // Unlike
                const res = await axios.delete(`${API_BASE_URL}/posts/${postId}/unlike`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setLikedPosts(prev => {
                    const next = new Set(prev);
                    next.delete(postId);
                    return next;
                });
                setPosts(posts.map(p => p.id === postId ? { ...p, likes_count: res.data.likes_count } : p));
            } else {
                // Like
                const res = await axios.post(
                    `${API_BASE_URL}/posts/${postId}/like`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setLikedPosts(prev => new Set(prev).add(postId));
                setPosts(posts.map(p => p.id === postId ? { ...p, likes_count: res.data.likes_count } : p));
            }
        } catch (error) {
            // If already liked on server, sync local state
            if (error.response?.data?.error === 'Already liked') {
                setLikedPosts(prev => new Set(prev).add(postId));
            }
            console.error('Like toggle error:', error);
        }
    };

    const handleDelete = async (postId) => {
        const token = localStorage.getItem('token');
        if (!token) {
            onRequireAuth();
            return;
        }

        if (!window.confirm('Are you sure you want to delete this post?')) return;

        try {
            await axios.delete(`${API_BASE_URL}/posts/${postId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPosts(posts.filter(p => p.id !== postId));
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to delete post');
        }
    };

    const handleUpdate = async (postId, updatedFields) => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const res = await axios.put(`${API_BASE_URL}/posts/${postId}`, updatedFields, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const updated = res.data.post;
            setPosts(posts.map(p => p.id === postId ? { ...p, ...updated } : p));
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to update post');
        }
    };

    if (loading) return <div className="loading-spinner">Loading posts feed...</div>;

    return (
        <div className="feed">
            {posts.length === 0 ? (
                <div className="empty-state card">
                    <h3>No posts yet</h3>
                    <p>Be the first member to share a story or insight with the community!</p>
                </div>
            ) : (
                posts.map(post => (
                    <Post
                        key={post.id}
                        post={post}
                        onLikeToggle={handleLikeToggle}
                        onDelete={handleDelete}
                        onUpdate={handleUpdate}
                        currentUserId={currentUserId}
                        onSelectUser={onSelectUser}
                        onRequireAuth={onRequireAuth}
                    />
                ))
            )}

            {hasMore && (
                <div className="load-more-container">
                    <button 
                        className="btn btn-outline btn-block"
                        onClick={() => fetchFeed(page + 1, true)}
                        disabled={loadingMore}
                    >
                        {loadingMore ? 'Loading more posts...' : '⬇️ Load More Posts'}
                    </button>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// 6. TRENDING POSTS COMPONENT (Part 2 - Bug 5: Normalized fields)
// ============================================================================
const TrendingPosts = ({ onSelectUser }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTrending();
    }, []);

    const fetchTrending = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/trending`);
            setPosts(response.data || []);
        } catch (error) {
            console.error('Error fetching trending:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading-spinner">Loading trending posts...</div>;

    return (
        <div className="trending card">
            <h2>🔥 Trending Posts (Last 7 Days)</h2>
            {posts.length === 0 ? (
                <p className="empty-state">No trending posts in the last 7 days.</p>
            ) : (
                <div className="trending-list">
                    {posts.map((post, index) => {
                        const author = post.username || post.author?.username || 'Anonymous';
                        return (
                            <div key={post.id} className="trending-item">
                                <span className="trending-rank">#{index + 1}</span>
                                <div className="trending-content">
                                    <h4>{post.title}</h4>
                                    <p className="trending-by">
                                        By: <strong onClick={() => post.user_id && onSelectUser && onSelectUser(post.user_id)}>@{author}</strong>
                                    </p>
                                    <div className="trending-stats">
                                        <span>❤️ {post.likes_count || 0} likes</span>
                                        <span>💬 {post.comment_count || 0} comments</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// 7. SEARCH COMPONENT (Part 2 - Bug 5, Bug 7)
// ============================================================================
const Search = ({ onSelectUser }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searched, setSearched] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/search`, {
                params: { q: query.trim() }
            });
            setResults(response.data || []);
            setSearched(true);
        } catch (error) {
            console.error('Error searching:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="search card">
            <h2>🔍 Search Content</h2>
            <form onSubmit={handleSearch} className="search-form">
                <input
                    type="text"
                    placeholder="Search posts by keywords, title, or topic..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="form-control"
                />
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </form>

            {searched && (
                <div className="search-results">
                    <h3>Results for "{query}"</h3>
                    {results.length === 0 ? (
                        <p className="empty-state">No matching posts found. Try another search term!</p>
                    ) : (
                        results.map(post => {
                            const author = post.username || post.author?.username || 'Anonymous';
                            return (
                                <div key={post.id} className="search-result-item">
                                    <h4>{post.title}</h4>
                                    <p className="search-snippet">
                                        {post.content ? (post.content.length > 180 ? post.content.slice(0, 180) + '...' : post.content) : ''}
                                    </p>
                                    <div className="search-item-footer">
                                        <span>Author: <strong onClick={() => post.user_id && onSelectUser && onSelectUser(post.user_id)}>@{author}</strong></span>
                                        <span>❤️ {post.likes_count || 0}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// 8. MAIN APP COMPONENT
// ============================================================================
const App = () => {
    const [currentUser, setCurrentUser] = useState(() => {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : null;
    });
    const [token, setToken] = useState(() => localStorage.getItem('token') || '');
    const [activeTab, setActiveTab] = useState('feed');
    const [refreshFeedKey, setRefreshFeedKey] = useState(0);
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [viewingProfileId, setViewingProfileId] = useState(null);

    // Sync user state on mount
    useEffect(() => {
        if (token && !currentUser) {
            axios.get(`${API_BASE_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            .then(res => {
                setCurrentUser(res.data);
                localStorage.setItem('user', JSON.stringify(res.data));
            })
            .catch(() => {
                // Expired or invalid token
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setToken('');
                setCurrentUser(null);
            });
        }
    }, [token]);

    const handleAuthSuccess = (user, authToken) => {
        setCurrentUser(user);
        setToken(authToken);
        setRefreshFeedKey(k => k + 1);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setCurrentUser(null);
        setToken('');
        if (activeTab === 'profile') setActiveTab('feed');
    };

    const handleSelectUser = (id) => {
        setViewingProfileId(id);
        setActiveTab('profile');
    };

    return (
        <div className="app">
            <header className="header">
                <div className="header-container">
                    <div className="brand" onClick={() => { setActiveTab('feed'); setViewingProfileId(null); }}>
                        <span className="brand-icon">🌐</span>
                        <h1>PulseSocial</h1>
                    </div>

                    <nav className="nav-tabs">
                        <button 
                            className={`nav-btn ${activeTab === 'feed' ? 'active' : ''}`} 
                            onClick={() => { setActiveTab('feed'); setViewingProfileId(null); }}
                        >
                            📰 Feed
                        </button>
                        <button 
                            className={`nav-btn ${activeTab === 'trending' ? 'active' : ''}`} 
                            onClick={() => { setActiveTab('trending'); setViewingProfileId(null); }}
                        >
                            🔥 Trending
                        </button>
                        <button 
                            className={`nav-btn ${activeTab === 'search' ? 'active' : ''}`} 
                            onClick={() => { setActiveTab('search'); setViewingProfileId(null); }}
                        >
                            🔍 Search
                        </button>
                        {currentUser && (
                            <button 
                                className={`nav-btn ${activeTab === 'profile' && viewingProfileId === currentUser.id ? 'active' : ''}`} 
                                onClick={() => { setViewingProfileId(currentUser.id); setActiveTab('profile'); }}
                            >
                                👤 Profile
                            </button>
                        )}
                    </nav>

                    <div className="user-controls">
                        {currentUser ? (
                            <div className="user-profile-badge">
                                <img 
                                    src={getAvatarUrl(currentUser, currentUser.username)} 
                                    alt={currentUser.username} 
                                    className="avatar-xs" 
                                />
                                <span className="user-greeting">@{currentUser.username}</span>
                                <button className="btn btn-sm btn-outline-light" onClick={handleLogout}>Log Out</button>
                            </div>
                        ) : (
                            <button className="btn btn-sm btn-light" onClick={() => setAuthModalOpen(true)}>
                                🔑 Log In / Register
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="main-content">
                {activeTab === 'feed' && (
                    <div className="feed-layout">
                        <CreatePost 
                            onPostCreated={() => setRefreshFeedKey(k => k + 1)} 
                            onRequireAuth={() => setAuthModalOpen(true)}
                        />
                        <Feed 
                            key={refreshFeedKey}
                            currentUserId={currentUser?.id} 
                            onSelectUser={handleSelectUser}
                            onRequireAuth={() => setAuthModalOpen(true)}
                        />
                    </div>
                )}

                {activeTab === 'trending' && (
                    <TrendingPosts onSelectUser={handleSelectUser} />
                )}

                {activeTab === 'search' && (
                    <Search onSelectUser={handleSelectUser} />
                )}

                {activeTab === 'profile' && (
                    <UserProfile 
                        userId={viewingProfileId || currentUser?.id || 1} 
                        onSelectUser={handleSelectUser}
                    />
                )}
            </main>

            <AuthModal 
                isOpen={authModalOpen} 
                onClose={() => setAuthModalOpen(false)} 
                onAuthSuccess={handleAuthSuccess}
            />

            <style>{`
                :root {
                    --primary: #3b82f6;
                    --primary-hover: #2563eb;
                    --dark: #111827;
                    --dark-surface: #1f2937;
                    --gray-light: #f3f4f6;
                    --gray-border: #e5e7eb;
                    --text-main: #1f2937;
                    --text-muted: #6b7280;
                    --danger: #ef4444;
                    --radius: 10px;
                }

                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    background-color: #f8fafc;
                    color: var(--text-main);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    line-height: 1.5;
                }

                .app {
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                }

                .header {
                    background: var(--dark-surface);
                    color: white;
                    padding: 0.75rem 1.5rem;
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                }

                .header-container {
                    max-width: 900px;
                    margin: 0 auto;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 1rem;
                }

                .brand {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                }

                .brand h1 { font-size: 1.35rem; font-weight: 700; letter-spacing: -0.5px; }
                .brand-icon { font-size: 1.5rem; }

                .nav-tabs {
                    display: flex;
                    gap: 0.35rem;
                }

                .nav-btn {
                    background: transparent;
                    color: #cbd5e1;
                    border: none;
                    padding: 0.5rem 0.85rem;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                    font-size: 0.95rem;
                    transition: all 0.15s ease;
                }

                .nav-btn:hover { background: rgba(255,255,255,0.08); color: white; }
                .nav-btn.active { background: var(--primary); color: white; }

                .user-controls {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .user-profile-badge {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .user-greeting { font-size: 0.85rem; font-weight: 600; color: #93c5fd; }

                .main-content {
                    max-width: 800px;
                    width: 100%;
                    margin: 1.5rem auto;
                    padding: 0 1rem;
                    flex: 1;
                }

                .card {
                    background: white;
                    border: 1px solid var(--gray-border);
                    border-radius: var(--radius);
                    padding: 1.25rem;
                    margin-bottom: 1.25rem;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
                }

                .form-control {
                    width: 100%;
                    padding: 0.65rem 0.85rem;
                    border: 1px solid var(--gray-border);
                    border-radius: 6px;
                    margin-bottom: 0.75rem;
                    font-size: 0.95rem;
                    font-family: inherit;
                }

                .form-control:focus {
                    outline: none;
                    border-color: var(--primary);
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
                }

                .btn {
                    padding: 0.6rem 1.2rem;
                    border-radius: 6px;
                    border: none;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.15s ease;
                    font-size: 0.9rem;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.4rem;
                }

                .btn-primary { background: var(--primary); color: white; }
                .btn-primary:hover:not(:disabled) { background: var(--primary-hover); }
                .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

                .btn-secondary { background: #e2e8f0; color: var(--text-main); }
                .btn-outline { background: transparent; border: 1px solid var(--gray-border); color: var(--text-main); }
                .btn-outline:hover { background: var(--gray-light); }
                .btn-outline-light { background: transparent; border: 1px solid rgba(255,255,255,0.4); color: white; }
                .btn-outline-light:hover { background: rgba(255,255,255,0.1); }
                .btn-light { background: white; color: var(--dark); }
                .btn-danger { background: #fee2e2; color: var(--danger); border: 1px solid #fca5a5; }
                .btn-danger:hover { background: #fecaca; }
                .btn-sm { padding: 0.35rem 0.65rem; font-size: 0.8rem; }
                .btn-block { width: 100%; }

                .avatar-large { width: 80px; height: 80px; border-radius: 50%; border: 3px solid var(--gray-light); background: #eee; }
                .avatar-small { width: 44px; height: 44px; border-radius: 50%; cursor: pointer; background: #eee; }
                .avatar-xs { width: 32px; height: 32px; border-radius: 50%; cursor: pointer; background: #eee; }

                .post-header {
                    display: flex;
                    align-items: center;
                    gap: 0.85rem;
                    margin-bottom: 0.85rem;
                }

                .post-meta { display: flex; flex-direction: column; }
                .author-name { font-weight: 600; cursor: pointer; color: var(--text-main); }
                .author-name:hover { text-decoration: underline; color: var(--primary); }
                .post-date { color: var(--text-muted); font-size: 0.8rem; }

                .post-title { font-size: 1.15rem; font-weight: 700; margin-bottom: 0.5rem; color: #0f172a; }
                .post-content { color: #334155; margin-bottom: 0.85rem; white-space: pre-wrap; word-break: break-word; }
                .post-image-container { margin: 0.85rem 0; border-radius: 8px; overflow: hidden; max-height: 400px; background: #000; }
                .post-image { width: 100%; height: auto; object-fit: cover; display: block; }

                .post-stats {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding-top: 0.75rem;
                    border-top: 1px solid #f1f5f9;
                }

                .stat-btn {
                    background: var(--gray-light);
                    border: none;
                    padding: 0.4rem 0.8rem;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 0.85rem;
                    font-weight: 600;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    transition: all 0.15s ease;
                }

                .stat-btn:hover { background: #e2e8f0; }
                .author-actions { margin-left: auto; display: flex; gap: 0.5rem; }

                .comments-section {
                    margin-top: 1rem;
                    padding-top: 1rem;
                    border-top: 1px dashed var(--gray-border);
                }

                .add-comment-form {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }

                .add-comment-form input {
                    flex: 1;
                    padding: 0.5rem 0.75rem;
                    border: 1px solid var(--gray-border);
                    border-radius: 6px;
                    font-size: 0.9rem;
                }

                .comment-item {
                    display: flex;
                    gap: 0.65rem;
                    margin-bottom: 0.75rem;
                }

                .comment-bubble {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 0.5rem 0.75rem;
                    flex: 1;
                }

                .comment-bubble-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.25rem;
                }

                .comment-bubble-header strong {
                    font-size: 0.85rem;
                    cursor: pointer;
                }

                .comment-delete-btn {
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    font-size: 1.1rem;
                    cursor: pointer;
                    line-height: 1;
                }

                .comment-delete-btn:hover { color: var(--danger); }
                .comment-text { font-size: 0.9rem; color: #334155; }
                .no-comments { color: var(--text-muted); font-size: 0.85rem; font-style: italic; }

                /* Profile styles */
                .profile-header {
                    display: flex;
                    gap: 1.5rem;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }

                .profile-details h2 { font-size: 1.4rem; color: #0f172a; }
                .profile-email { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0.4rem; }
                .profile-bio { color: #334155; font-size: 0.95rem; }
                .profile-bio-empty { color: #94a3b8; font-style: italic; font-size: 0.9rem; }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .stat-card {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    padding: 1rem;
                    border-radius: 8px;
                    text-align: center;
                }

                .stat-number { display: block; font-size: 1.5rem; font-weight: 700; color: var(--primary); }
                .stat-label { font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600; }

                .recent-posts-list { margin-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
                .recent-post-item { padding: 0.75rem; background: #f8fafc; border-radius: 6px; border-left: 3px solid var(--primary); }
                .recent-post-item strong { display: block; font-size: 0.95rem; }
                .recent-post-item p { font-size: 0.85rem; color: #475569; margin: 0.25rem 0; }
                .recent-post-item small { color: var(--text-muted); }

                /* Trending and Search */
                .trending-list { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
                .trending-item {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 0.85rem;
                    background: #f8fafc;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                }

                .trending-rank { font-size: 1.25rem; font-weight: 800; color: #94a3b8; min-width: 32px; }
                .trending-content { flex: 1; }
                .trending-content h4 { font-size: 1rem; margin-bottom: 0.2rem; }
                .trending-by { font-size: 0.85rem; color: var(--text-muted); }
                .trending-by strong { cursor: pointer; color: var(--text-main); }
                .trending-stats { display: flex; gap: 1rem; font-size: 0.8rem; color: #64748b; margin-top: 0.25rem; }

                .search-form { display: flex; gap: 0.5rem; margin: 1rem 0; }
                .search-results { margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
                .search-result-item { padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
                .search-result-item h4 { font-size: 1.05rem; margin-bottom: 0.35rem; }
                .search-snippet { font-size: 0.9rem; color: #475569; margin-bottom: 0.5rem; }
                .search-item-footer { display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted); }
                .search-item-footer strong { cursor: pointer; color: var(--text-main); }

                /* Modals and Alerts */
                .modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.55);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 1rem;
                }

                .modal-content {
                    background: white;
                    border-radius: var(--radius);
                    max-width: 420px;
                    width: 100%;
                    padding: 1.5rem;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.25rem;
                }

                .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
                .form-group { margin-bottom: 1rem; }
                .form-group label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.35rem; }
                .form-group input, .form-group textarea {
                    width: 100%; padding: 0.6rem 0.75rem; border: 1px solid var(--gray-border); border-radius: 6px; font-family: inherit; font-size: 0.9rem;
                }
                .modal-footer { margin-top: 1.25rem; text-align: center; font-size: 0.85rem; }
                .link-btn { background: none; border: none; color: var(--primary); font-weight: 600; cursor: pointer; }

                .alert { padding: 0.65rem 0.85rem; border-radius: 6px; font-size: 0.85rem; margin-bottom: 1rem; }
                .alert-error { background: #fee2e2; color: #991b1b; border: 1px solid #f87171; }
                .empty-state { text-align: center; padding: 2rem; color: var(--text-muted); }
                .loading-spinner { text-align: center; padding: 2.5rem; color: var(--text-muted); font-size: 0.95rem; }
                .load-more-container { text-align: center; margin: 1.5rem 0; }
            `}</style>
        </div>
    );
};

export default App;
