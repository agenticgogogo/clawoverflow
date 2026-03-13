package com.moltbook.sdk

import com.moltbook.sdk.client.*
import com.moltbook.sdk.models.*
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.assertThrows

/**
 * Test suite for Moltbook Kotlin SDK
 */
class MoltbookClientTest {
    
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }
    
    // ==========================================================================
    // Client Configuration Tests
    // ==========================================================================
    
    @Test
    fun `client creates with default config`() {
        val client = MoltbookClient()
        assertNotNull(client)
    }
    
    @Test
    fun `client creates with api key`() {
        val client = MoltbookClient(MoltbookClientConfig(apiKey = "moltbook_test123"))
        assertNotNull(client)
        client.close()
    }
    
    @Test
    fun `client creates with full config`() {
        val config = MoltbookClientConfig(
            apiKey = "moltbook_test123",
            baseUrl = "https://api.test.com",
            timeout = 60000,
            retries = 5
        )
        val client = MoltbookClient(config)
        assertNotNull(client)
        client.close()
    }
    
    @Test
    fun `setApiKey updates key`() {
        val client = MoltbookClient()
        client.setApiKey("moltbook_newkey123")
        // Should not throw
        client.close()
    }
    
    // ==========================================================================
    // Resource Availability Tests
    // ==========================================================================
    
    @Test
    fun `client has agents resource`() {
        val client = MoltbookClient()
        assertNotNull(client.agents)
        client.close()
    }
    
    @Test
    fun `client has posts resource`() {
        val client = MoltbookClient()
        assertNotNull(client.posts)
        client.close()
    }
    
    @Test
    fun `client has comments resource`() {
        val client = MoltbookClient()
        assertNotNull(client.comments)
        client.close()
    }
    
    @Test
    fun `client has submolts resource`() {
        val client = MoltbookClient()
        assertNotNull(client.submolts)
        client.close()
    }
    
    @Test
    fun `client has feed resource`() {
        val client = MoltbookClient()
        assertNotNull(client.feed)
        client.close()
    }
    
    @Test
    fun `client has search resource`() {
        val client = MoltbookClient()
        assertNotNull(client.search)
        client.close()
    }
    
    // ==========================================================================
    // Model Deserialization Tests
    // ==========================================================================
    
    @Test
    fun `Agent deserializes correctly`() {
        val jsonString = """
            {
                "id": "agent_123",
                "name": "test_agent",
                "display_name": "Test Agent",
                "description": "A test agent",
                "karma": 100,
                "status": "active",
                "is_claimed": true,
                "follower_count": 50,
                "following_count": 25,
                "created_at": "2025-01-01T00:00:00Z"
            }
        """
        
        val agent = json.decodeFromString<Agent>(jsonString)
        
        assertEquals("agent_123", agent.id)
        assertEquals("test_agent", agent.name)
        assertEquals("Test Agent", agent.displayName)
        assertEquals(100, agent.karma)
        assertEquals(AgentStatus.ACTIVE, agent.status)
        assertTrue(agent.isClaimed)
    }
    
    @Test
    fun `Post deserializes correctly`() {
        val jsonString = """
            {
                "id": "post_123",
                "title": "Test Post",
                "content": "Post content",
                "submolt": "general",
                "post_type": "text",
                "score": 42,
                "comment_count": 5,
                "author_name": "test_agent",
                "created_at": "2025-01-01T00:00:00Z"
            }
        """
        
        val post = json.decodeFromString<Post>(jsonString)
        
        assertEquals("post_123", post.id)
        assertEquals("Test Post", post.title)
        assertEquals(PostType.TEXT, post.postType)
        assertEquals(42, post.score)
        assertEquals(5, post.commentCount)
    }
    
    @Test
    fun `Comment deserializes correctly`() {
        val jsonString = """
            {
                "id": "comment_123",
                "content": "Great post!",
                "score": 10,
                "upvotes": 12,
                "downvotes": 2,
                "parent_id": null,
                "depth": 0,
                "author_name": "test_agent",
                "created_at": "2025-01-01T00:00:00Z"
            }
        """
        
        val comment = json.decodeFromString<Comment>(jsonString)
        
        assertEquals("comment_123", comment.id)
        assertEquals("Great post!", comment.content)
        assertEquals(10, comment.score)
        assertEquals(12, comment.upvotes)
        assertEquals(2, comment.downvotes)
        assertNull(comment.parentId)
    }
    
    @Test
    fun `Submolt deserializes correctly`() {
        val jsonString = """
            {
                "id": "submolt_123",
                "name": "general",
                "display_name": "General",
                "description": "General discussion",
                "subscriber_count": 1000,
                "created_at": "2025-01-01T00:00:00Z",
                "is_subscribed": true
            }
        """
        
        val submolt = json.decodeFromString<Submolt>(jsonString)
        
        assertEquals("submolt_123", submolt.id)
        assertEquals("general", submolt.name)
        assertEquals("General", submolt.displayName)
        assertEquals(1000, submolt.subscriberCount)
        assertEquals(true, submolt.isSubscribed)
    }
    
    @Test
    fun `VoteResponse deserializes correctly`() {
        val jsonString = """
            {
                "success": true,
                "message": "Upvoted!",
                "action": "upvoted"
            }
        """
        
        val response = json.decodeFromString<VoteResponse>(jsonString)
        
        assertTrue(response.success)
        assertEquals("Upvoted!", response.message)
        assertEquals("upvoted", response.action)
    }
    
    @Test
    fun `SearchResults deserializes correctly`() {
        val jsonString = """
            {
                "posts": [],
                "agents": [],
                "submolts": []
            }
        """
        
        val results = json.decodeFromString<SearchResults>(jsonString)
        
        assertTrue(results.posts.isEmpty())
        assertTrue(results.agents.isEmpty())
        assertTrue(results.submolts.isEmpty())
    }
    
    // ==========================================================================
    // Enum Tests
    // ==========================================================================
    
    @Test
    fun `AgentStatus enum values`() {
        assertEquals("pending_claim", AgentStatus.PENDING_CLAIM.name.lowercase().replace("_", "_"))
        assertEquals(AgentStatus.ACTIVE, AgentStatus.valueOf("ACTIVE"))
        assertEquals(AgentStatus.SUSPENDED, AgentStatus.valueOf("SUSPENDED"))
    }
    
    @Test
    fun `PostType enum values`() {
        assertEquals(PostType.TEXT, PostType.valueOf("TEXT"))
        assertEquals(PostType.LINK, PostType.valueOf("LINK"))
    }
    
    // ==========================================================================
    // Exception Tests
    // ==========================================================================
    
    @Test
    fun `AuthenticationException has correct status code`() {
        val exception = MoltbookException.AuthenticationException("Invalid key")
        assertEquals(401, exception.statusCode)
    }
    
    @Test
    fun `ForbiddenException has correct status code`() {
        val exception = MoltbookException.ForbiddenException("Access denied")
        assertEquals(403, exception.statusCode)
    }
    
    @Test
    fun `NotFoundException has correct status code`() {
        val exception = MoltbookException.NotFoundException("Not found")
        assertEquals(404, exception.statusCode)
    }
    
    @Test
    fun `ValidationException has correct status code`() {
        val exception = MoltbookException.ValidationException("Invalid input")
        assertEquals(400, exception.statusCode)
    }
    
    @Test
    fun `RateLimitException has retry info`() {
        val exception = MoltbookException.RateLimitException("Rate limited", 30)
        assertEquals(429, exception.statusCode)
        assertEquals(30, exception.retryAfter)
    }
    
    @Test
    fun `ServerException has custom status code`() {
        val exception = MoltbookException.ServerException("Server error", 503)
        assertEquals(503, exception.statusCode)
    }
    
    // ==========================================================================
    // PaginatedResponse Tests
    // ==========================================================================
    
    @Test
    fun `PaginatedResponse deserializes correctly`() {
        val jsonString = """
            {
                "success": true,
                "data": [],
                "pagination": {
                    "count": 0,
                    "limit": 25,
                    "offset": 0,
                    "hasMore": false
                }
            }
        """
        
        val response = json.decodeFromString<PaginatedResponse<Post>>(jsonString)
        
        assertTrue(response.success)
        assertTrue(response.data.isEmpty())
        assertEquals(25, response.pagination.limit)
        assertFalse(response.pagination.hasMore)
    }
}
