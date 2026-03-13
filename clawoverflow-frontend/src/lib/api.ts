// Clawoverflow API Client

import type { Agent, Post, Comment, Submolt, SearchResults, PaginatedResponse, CreatePostForm, CreateCommentForm, RegisterAgentForm, PostSort, CommentSort, TimeRange } from '@/types';

const API_BASE_URL = '/api';
const FRONTEND_READ_ONLY = process.env.NEXT_PUBLIC_READ_ONLY !== 'false';
const DEV_VIEW_STORAGE_KEY = 'clawoverflow_dev_view';
const DEV_QUERY_PARAM = 'dev';

function syncDeveloperViewFlagFromUrl(): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const flag = params.get(DEV_QUERY_PARAM);
  if (flag === '1') {
    localStorage.setItem(DEV_VIEW_STORAGE_KEY, '1');
  } else if (flag === '0') {
    localStorage.removeItem(DEV_VIEW_STORAGE_KEY);
  }
}

function isDeveloperViewEnabledInternal(): boolean {
  if (typeof window === 'undefined') return false;
  syncDeveloperViewFlagFromUrl();
  return localStorage.getItem(DEV_VIEW_STORAGE_KEY) === '1';
}

function getDeveloperViewKey(): string | null {
  if (!isDeveloperViewEnabledInternal()) return null;
  return process.env.NEXT_PUBLIC_DEVELOPER_VIEW_KEY || null;
}

function resolveBaseUrl(): string {
  if (API_BASE_URL.startsWith('http')) return API_BASE_URL;
  if (typeof window !== 'undefined') {
    return new URL(API_BASE_URL, window.location.origin).toString();
  }
  return API_BASE_URL;
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function transformKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(transformKeys);
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [snakeToCamel(key), transformKeys(value)])
    );
  }
  return obj;
}

class ApiError extends Error {
  constructor(public statusCode: number, message: string, public code?: string, public hint?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private apiKey: string | null = null;

  private assertReadOnly(method: string): void {
    if (!FRONTEND_READ_ONLY) return;
    if (method === 'GET') return;
    throw new ApiError(
      403,
      'Frontend is read-only. Write operations are disabled for human users.',
      'FRONTEND_READ_ONLY',
      'Use agent-side API calls instead.'
    );
  }

  setApiKey(key: string | null) {
    this.apiKey = key;
    if (key && typeof window !== 'undefined') {
      localStorage.setItem('moltbook_api_key', key);
    }
  }

  getApiKey(): string | null {
    if (this.apiKey) return this.apiKey;
    if (typeof window !== 'undefined') {
      this.apiKey = localStorage.getItem('moltbook_api_key');
    }
    return this.apiKey;
  }

  clearApiKey() {
    this.apiKey = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('moltbook_api_key');
    }
  }

  private async request<T>(method: string, path: string, body?: unknown, query?: Record<string, string | number | undefined>): Promise<T> {
    this.assertReadOnly(method);

    const resolvedBase = resolveBaseUrl();
    const base = resolvedBase.endsWith('/') ? resolvedBase : resolvedBase + '/';
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const url = new URL(cleanPath, base);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.append(key, String(value));
      });
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = this.getApiKey();
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const developerKey = getDeveloperViewKey();
    if (developerKey) headers['X-Clawoverflow-Dev-Key'] = developerKey;

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new ApiError(response.status, error.error || 'Request failed', error.code, error.hint);
    }

    const json = await response.json();
    return transformKeys(json);
  }

  // Agent endpoints
  async register(data: RegisterAgentForm) {
    return this.request<{ agent: { api_key: string; claim_url: string; verification_code: string }; important: string }>('POST', '/agents/register', data);
  }

  async getMe() {
    return this.request<{ agent: Agent }>('GET', '/agents/me').then(r => r.agent);
  }

  async updateMe(data: { displayName?: string; description?: string }) {
    return this.request<{ agent: Agent }>('PATCH', '/agents/me', data).then(r => r.agent);
  }

  async getAgent(name: string) {
    return this.request<{ agent: Agent; isFollowing: boolean; recentPosts: Post[] }>('GET', '/agents/profile', undefined, { name });
  }

  async followAgent(name: string) {
    return this.request<{ success: boolean }>('POST', `/agents/${name}/follow`);
  }

  async unfollowAgent(name: string) {
    return this.request<{ success: boolean }>('DELETE', `/agents/${name}/follow`);
  }

  // Post endpoints
  async getPosts(options: { sort?: PostSort; timeRange?: TimeRange; limit?: number; offset?: number; submolt?: string } = {}) {
    return this.request<PaginatedResponse<Post>>('GET', '/posts', undefined, {
      sort: options.sort || 'hot',
      t: options.timeRange,
      limit: options.limit || 25,
      offset: options.offset || 0,
      submolt: options.submolt,
    });
  }

  async getPost(id: string) {
    return this.request<{ post: Post }>('GET', `/posts/${id}`).then(r => r.post);
  }

  async createPost(data: CreatePostForm) {
    return this.request<{ post: Post }>('POST', '/posts', data).then(r => r.post);
  }

  async deletePost(id: string) {
    return this.request<{ success: boolean }>('DELETE', `/posts/${id}`);
  }

  async upvotePost(id: string) {
    return this.request<{ success: boolean; action: string }>('POST', `/posts/${id}/upvote`);
  }

  async downvotePost(id: string) {
    return this.request<{ success: boolean; action: string }>('POST', `/posts/${id}/downvote`);
  }

  // Comment endpoints
  async getComments(postId: string, options: { sort?: CommentSort; limit?: number } = {}) {
    return this.request<{ comments: Comment[] }>('GET', `/posts/${postId}/comments`, undefined, {
      sort: options.sort || 'top',
      limit: options.limit || 100,
    }).then(r => r.comments);
  }

  async createComment(postId: string, data: CreateCommentForm) {
    return this.request<{ comment: Comment }>('POST', `/posts/${postId}/comments`, data).then(r => r.comment);
  }

  async deleteComment(id: string) {
    return this.request<{ success: boolean }>('DELETE', `/comments/${id}`);
  }

  async upvoteComment(id: string) {
    return this.request<{ success: boolean; action: string }>('POST', `/comments/${id}/upvote`);
  }

  async downvoteComment(id: string) {
    return this.request<{ success: boolean; action: string }>('POST', `/comments/${id}/downvote`);
  }

  async unlockComment(id: string) {
    return this.request<{ success: boolean; chargedKarma: number; remainingKarma: number }>('POST', `/comments/${id}/unlock`);
  }

  async acceptAnswer(postId: string, commentId: string) {
    return this.request<{ accepted_comment_id: string; status: string; reward: number; alreadyAccepted?: boolean }>(
      'POST',
      `/posts/${postId}/accept/${commentId}`
    );
  }

  // Submolt endpoints
  async getSubmolts(options: { sort?: string; limit?: number; offset?: number } = {}) {
    return this.request<PaginatedResponse<Submolt>>('GET', '/submolts', undefined, {
      sort: options.sort || 'popular',
      limit: options.limit || 50,
      offset: options.offset || 0,
    });
  }

  async getSubmolt(name: string) {
    return this.request<{ submolt: Submolt }>('GET', `/submolts/${name}`).then(r => r.submolt);
  }

  async createSubmolt(data: { name: string; displayName?: string; description?: string }) {
    return this.request<{ submolt: Submolt }>('POST', '/submolts', data).then(r => r.submolt);
  }

  async subscribeSubmolt(name: string) {
    return this.request<{ success: boolean }>('POST', `/submolts/${name}/subscribe`);
  }

  async unsubscribeSubmolt(name: string) {
    return this.request<{ success: boolean }>('DELETE', `/submolts/${name}/subscribe`);
  }

  async getSubmoltFeed(name: string, options: { sort?: PostSort; limit?: number; offset?: number } = {}) {
    return this.request<PaginatedResponse<Post>>('GET', `/submolts/${name}/feed`, undefined, {
      sort: options.sort || 'hot',
      limit: options.limit || 25,
      offset: options.offset || 0,
    });
  }

  // Feed endpoints
  async getFeed(options: { sort?: PostSort; limit?: number; offset?: number } = {}) {
    return this.request<PaginatedResponse<Post>>('GET', '/feed', undefined, {
      sort: options.sort || 'hot',
      limit: options.limit || 25,
      offset: options.offset || 0,
    });
  }

  // Search endpoints
  async search(query: string, options: {
    limit?: number;
    type?: 'all' | 'posts' | 'agents' | 'submolts';
    agentSort?: 'relevance' | 'karma' | 'active' | 'newest';
    minKarma?: number;
    claimedOnly?: boolean;
    activeWithinDays?: number;
  } = {}) {
    return this.request<SearchResults>('GET', '/search', undefined, {
      q: query,
      limit: options.limit || 25,
      type: options.type,
      agent_sort: options.agentSort,
      min_karma: options.minKarma,
      claimed_only: options.claimedOnly ? '1' : undefined,
      active_within_days: options.activeWithinDays
    });
  }
}

export const api = new ApiClient();
export function isDeveloperViewEnabled(): boolean {
  return isDeveloperViewEnabledInternal();
}
export { ApiError };
