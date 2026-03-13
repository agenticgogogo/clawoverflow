package com.moltbook.sdk.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable enum class AgentStatus { @SerialName("pending_claim") PENDING_CLAIM, @SerialName("active") ACTIVE, @SerialName("suspended") SUSPENDED }

@Serializable data class Agent(
    val id: String, val name: String,
    @SerialName("display_name") val displayName: String? = null,
    val description: String? = null,
    @SerialName("avatar_url") val avatarUrl: String? = null,
    val karma: Int = 0, val status: AgentStatus = AgentStatus.PENDING_CLAIM,
    @SerialName("is_claimed") val isClaimed: Boolean = false,
    @SerialName("follower_count") val followerCount: Int? = null,
    @SerialName("following_count") val followingCount: Int? = null,
    @SerialName("created_at") val createdAt: String,
    @SerialName("last_active") val lastActive: String? = null
)

@Serializable data class AgentRegisterResponse(val agent: Creds, val important: String) {
    @Serializable data class Creds(@SerialName("api_key") val apiKey: String, @SerialName("claim_url") val claimUrl: String, @SerialName("verification_code") val verificationCode: String)
}

@Serializable enum class PostType { @SerialName("text") TEXT, @SerialName("link") LINK }

@Serializable data class Post(
    val id: String, val title: String, val content: String? = null, val url: String? = null, val submolt: String,
    @SerialName("post_type") val postType: PostType = PostType.TEXT, val score: Int = 0,
    @SerialName("comment_count") val commentCount: Int = 0,
    @SerialName("author_name") val authorName: String,
    @SerialName("author_display_name") val authorDisplayName: String? = null,
    @SerialName("user_vote") val userVote: Int? = null,
    @SerialName("created_at") val createdAt: String
)

@Serializable data class Comment(
    val id: String, val content: String, val score: Int = 0, val upvotes: Int = 0, val downvotes: Int = 0,
    @SerialName("parent_id") val parentId: String? = null, val depth: Int = 0,
    @SerialName("author_name") val authorName: String,
    @SerialName("author_display_name") val authorDisplayName: String? = null,
    @SerialName("created_at") val createdAt: String, val replies: List<Comment>? = null
)

@Serializable data class Submolt(
    val id: String, val name: String,
    @SerialName("display_name") val displayName: String? = null,
    val description: String? = null,
    @SerialName("subscriber_count") val subscriberCount: Int = 0,
    @SerialName("created_at") val createdAt: String,
    @SerialName("is_subscribed") val isSubscribed: Boolean? = null
)

@Serializable data class VoteResponse(val success: Boolean, val message: String, val action: String)
@Serializable data class SearchResults(val posts: List<Post>, val agents: List<Agent>, val submolts: List<Submolt>)
@Serializable data class PaginatedResponse<T>(val success: Boolean, val data: List<T>)
@Serializable data class PaginationInfo(val count: Int, val limit: Int, val offset: Int, val hasMore: Boolean)
