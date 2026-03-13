// MoltbookSDKTests.swift
// Tests for MoltbookSDK

import XCTest
@testable import MoltbookSDK

final class MoltbookSDKTests: XCTestCase {
    
    // MARK: - Client Configuration Tests
    
    func testClientCreationWithDefaultConfig() {
        let client = MoltbookClient()
        XCTAssertNotNil(client)
    }
    
    func testClientCreationWithApiKey() {
        let client = MoltbookClient(apiKey: "moltbook_test123")
        XCTAssertNotNil(client)
    }
    
    func testClientCreationWithFullConfig() {
        let config = MoltbookClientConfig(
            apiKey: "moltbook_test123",
            baseUrl: "https://api.test.com",
            timeout: 60,
            retries: 5
        )
        let client = MoltbookClient(config: config)
        XCTAssertNotNil(client)
    }
    
    // MARK: - Resource Availability Tests
    
    func testClientHasAgentsResource() {
        let client = MoltbookClient()
        XCTAssertNotNil(client.agents)
    }
    
    func testClientHasPostsResource() {
        let client = MoltbookClient()
        XCTAssertNotNil(client.posts)
    }
    
    func testClientHasCommentsResource() {
        let client = MoltbookClient()
        XCTAssertNotNil(client.comments)
    }
    
    func testClientHasSubmoltsResource() {
        let client = MoltbookClient()
        XCTAssertNotNil(client.submolts)
    }
    
    func testClientHasFeedResource() {
        let client = MoltbookClient()
        XCTAssertNotNil(client.feed)
    }
    
    func testClientHasSearchResource() {
        let client = MoltbookClient()
        XCTAssertNotNil(client.search)
    }
    
    // MARK: - Error Tests
    
    func testAuthenticationErrorProperties() {
        let error = MoltbookError.authentication(message: "Invalid key", hint: "Check API key")
        
        XCTAssertEqual(error.statusCode, 401)
        XCTAssertFalse(error.isRetryable)
    }
    
    func testRateLimitErrorProperties() {
        let error = MoltbookError.rateLimited(message: "Too many requests", retryAfter: 30, hint: nil)
        
        XCTAssertEqual(error.statusCode, 429)
        XCTAssertEqual(error.retryAfter, 30)
        XCTAssertTrue(error.isRetryable)
    }
    
    func testNotFoundErrorProperties() {
        let error = MoltbookError.notFound(message: "Post not found", hint: nil)
        
        XCTAssertEqual(error.statusCode, 404)
        XCTAssertFalse(error.isRetryable)
    }
    
    func testValidationErrorProperties() {
        let error = MoltbookError.validation(message: "Invalid input", code: "VALIDATION", hint: "Check fields")
        
        XCTAssertEqual(error.statusCode, 400)
        XCTAssertFalse(error.isRetryable)
    }
    
    func testServerErrorIsRetryable() {
        let error = MoltbookError.server(message: "Internal error", statusCode: 500)
        
        XCTAssertEqual(error.statusCode, 500)
        XCTAssertTrue(error.isRetryable)
    }
    
    func testNetworkErrorIsRetryable() {
        let underlying = NSError(domain: "test", code: -1009)
        let error = MoltbookError.network(underlying: underlying)
        
        XCTAssertTrue(error.isRetryable)
    }
    
    func testTimeoutErrorIsRetryable() {
        let error = MoltbookError.timeout
        
        XCTAssertTrue(error.isRetryable)
    }
    
    // MARK: - Model Tests
    
    func testAgentDecoding() throws {
        let json = """
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
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        let agent = try decoder.decode(Agent.self, from: json.data(using: .utf8)!)
        
        XCTAssertEqual(agent.id, "agent_123")
        XCTAssertEqual(agent.name, "test_agent")
        XCTAssertEqual(agent.displayName, "Test Agent")
        XCTAssertEqual(agent.karma, 100)
        XCTAssertEqual(agent.status, .active)
        XCTAssertTrue(agent.isClaimed)
    }
    
    func testPostDecoding() throws {
        let json = """
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
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        let post = try decoder.decode(Post.self, from: json.data(using: .utf8)!)
        
        XCTAssertEqual(post.id, "post_123")
        XCTAssertEqual(post.title, "Test Post")
        XCTAssertEqual(post.postType, .text)
        XCTAssertEqual(post.score, 42)
    }
    
    func testCommentDecoding() throws {
        let json = """
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
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        let comment = try decoder.decode(Comment.self, from: json.data(using: .utf8)!)
        
        XCTAssertEqual(comment.id, "comment_123")
        XCTAssertEqual(comment.content, "Great post!")
        XCTAssertEqual(comment.score, 10)
        XCTAssertNil(comment.parentId)
    }
    
    func testSubmoltDecoding() throws {
        let json = """
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
        
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        
        let submolt = try decoder.decode(Submolt.self, from: json.data(using: .utf8)!)
        
        XCTAssertEqual(submolt.id, "submolt_123")
        XCTAssertEqual(submolt.name, "general")
        XCTAssertEqual(submolt.subscriberCount, 1000)
        XCTAssertEqual(submolt.isSubscribed, true)
    }
    
    func testVoteResponseDecoding() throws {
        let json = """
        {
            "success": true,
            "message": "Upvoted!",
            "action": "upvoted"
        }
        """
        
        let response = try JSONDecoder().decode(VoteResponse.self, from: json.data(using: .utf8)!)
        
        XCTAssertTrue(response.success)
        XCTAssertEqual(response.action, .upvoted)
    }
    
    // MARK: - Request Building Tests
    
    func testAgentRegisterRequestEncoding() throws {
        let request = AgentRegisterRequest(name: "test_agent", description: "A test")
        
        let encoder = JSONEncoder()
        let data = try encoder.encode(request)
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        
        XCTAssertEqual(json["name"] as? String, "test_agent")
        XCTAssertEqual(json["description"] as? String, "A test")
    }
    
    func testCreatePostRequestEncoding() throws {
        let request = CreatePostRequest(
            submolt: "general",
            title: "Test Post",
            content: "Content here"
        )
        
        let encoder = JSONEncoder()
        let data = try encoder.encode(request)
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        
        XCTAssertEqual(json["submolt"] as? String, "general")
        XCTAssertEqual(json["title"] as? String, "Test Post")
        XCTAssertEqual(json["content"] as? String, "Content here")
    }
    
    func testCreateCommentRequestEncoding() throws {
        let request = CreateCommentRequest(content: "Nice!", parentId: "comment_123")
        
        let encoder = JSONEncoder()
        let data = try encoder.encode(request)
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        
        XCTAssertEqual(json["content"] as? String, "Nice!")
        XCTAssertEqual(json["parent_id"] as? String, "comment_123")
    }
    
    // MARK: - Enum Tests
    
    func testAgentStatusValues() {
        XCTAssertEqual(AgentStatus.pendingClaim.rawValue, "pending_claim")
        XCTAssertEqual(AgentStatus.active.rawValue, "active")
        XCTAssertEqual(AgentStatus.suspended.rawValue, "suspended")
    }
    
    func testPostTypeValues() {
        XCTAssertEqual(PostType.text.rawValue, "text")
        XCTAssertEqual(PostType.link.rawValue, "link")
    }
    
    func testPostSortValues() {
        XCTAssertEqual(PostSort.hot.rawValue, "hot")
        XCTAssertEqual(PostSort.new.rawValue, "new")
        XCTAssertEqual(PostSort.top.rawValue, "top")
        XCTAssertEqual(PostSort.rising.rawValue, "rising")
    }
    
    func testCommentSortValues() {
        XCTAssertEqual(CommentSort.top.rawValue, "top")
        XCTAssertEqual(CommentSort.new.rawValue, "new")
        XCTAssertEqual(CommentSort.controversial.rawValue, "controversial")
    }
    
    func testVoteActionValues() {
        XCTAssertEqual(VoteAction.upvoted.rawValue, "upvoted")
        XCTAssertEqual(VoteAction.downvoted.rawValue, "downvoted")
        XCTAssertEqual(VoteAction.removed.rawValue, "removed")
        XCTAssertEqual(VoteAction.changed.rawValue, "changed")
    }
}
