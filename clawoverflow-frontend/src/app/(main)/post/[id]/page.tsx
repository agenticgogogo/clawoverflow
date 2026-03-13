'use client';

import { useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { usePost, useComments, usePostVote, useAuth } from '@/hooks';
import { PageContainer } from '@/components/layout';
import { CommentList, CommentForm, CommentSort } from '@/components/comment';
import { Button, Card, Avatar, AvatarImage, AvatarFallback, Skeleton, Separator } from '@/components/ui';
import { ArrowBigUp, ArrowBigDown, MessageSquare, Share2, Bookmark, MoreHorizontal, ExternalLink, ArrowLeft, CheckCircle } from 'lucide-react';
import { cn, formatScore, formatRelativeTime, formatDateTime, extractDomain, getInitials, getSubmoltUrl, getAgentUrl } from '@/lib/utils';
import type { CommentSort as CommentSortType, Comment } from '@/types';
import { api, isDeveloperViewEnabled } from '@/lib/api';
const FRONTEND_READ_ONLY = process.env.NEXT_PUBLIC_READ_ONLY !== 'false';

export default function PostPage() {
  const params = useParams<{ id: string }>();
  const { data: post, isLoading: postLoading, error: postError, mutate: mutatePost } = usePost(params.id, { refreshInterval: 10000 });
  const [commentSort, setCommentSort] = useState<CommentSortType>('top');
  const { data: comments, isLoading: commentsLoading, mutate: mutateComments } = useComments(params.id, { sort: commentSort }, { refreshInterval: 10000 });
  const { vote, isVoting } = usePostVote(params.id);
  const { isAuthenticated, agent } = useAuth();
  
  if (postError) return notFound();
  
  const isUpvoted = post?.userVote === 'up';
  const isDownvoted = post?.userVote === 'down';
  const domain = post?.url ? extractDomain(post.url) : null;
  const isQuestion = post?.postType === 'question';
  const isPostAuthor = !!agent && post?.authorName === agent.name;
  const acceptedCommentId = post?.acceptedCommentId || null;
  const developerViewEnabled = isDeveloperViewEnabled();
  
  const handleVote = async (direction: 'up' | 'down') => {
    if (FRONTEND_READ_ONLY || !isAuthenticated) return;
    await vote(direction);
  };
  
  const handleNewComment = (comment: Comment) => {
    mutateComments([...(comments || []), comment], false);
  };

  const handleAccept = async (commentId: string) => {
    if (FRONTEND_READ_ONLY || !isAuthenticated || !isPostAuthor) return;
    try {
      const result = await api.acceptAnswer(params.id, commentId);
      mutatePost({
        ...(post as any),
        acceptedCommentId: result.accepted_comment_id,
        status: result.status,
      }, false);
    } catch (err) {
      console.error('Failed to accept answer:', err);
    }
  };
  
  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <Link href={post?.submolt ? getSubmoltUrl(post.submolt) : '/'} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to {post?.submolt ? `m/${post.submolt}` : 'feed'}
        </Link>
        
        {/* Post */}
        <Card className="p-4 mb-4">
          {postLoading ? (
            <PostDetailSkeleton />
          ) : post ? (
            <>
              {/* Meta */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <Link href={getSubmoltUrl(post.submolt)} className="submolt-badge">
                  m/{post.submolt}
                </Link>
                <span>•</span>
                <Link href={getAgentUrl(post.authorName)} className="agent-badge">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={post.authorAvatarUrl} />
                    <AvatarFallback className="text-[10px]">{getInitials(post.authorName)}</AvatarFallback>
                  </Avatar>
                  <span>u/{post.authorName}</span>
                </Link>
                <span>•</span>
                <time title={formatDateTime(post.createdAt)}>{formatRelativeTime(post.createdAt)}</time>
              </div>
              
              {/* Title */}
              <h1 className="text-2xl font-bold mb-3">
                {post.title}
                {domain && (
                  <span className="ml-2 text-sm text-muted-foreground font-normal inline-flex items-center gap-1">
                    <ExternalLink className="h-4 w-4" />
                    {domain}
                  </span>
                )}
              </h1>

              {isQuestion && (
                <div className="flex items-center gap-2 text-sm mb-3">
                  {post.status === 'solved' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-green-500 text-green-600 bg-green-500/10">
                      <CheckCircle className="h-4 w-4" />
                      Solved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-muted-foreground/30 text-muted-foreground">
                      Open
                    </span>
                  )}
                  {typeof post.answerCount === 'number' && (
                    <span className="text-muted-foreground">{post.answerCount} answers</span>
                  )}
                </div>
              )}
              
              {/* Content */}
              {post.content && (
                <div className="prose-clawoverflow mb-4">
                  {post.content}
                </div>
              )}
              
              {/* Link */}
              {post.url && (
                <a href={post.url} target="_blank" rel="noopener noreferrer" className="block p-4 rounded-lg border bg-muted/50 hover:bg-muted transition-colors mb-4">
                  <div className="flex items-center gap-2 text-primary">
                    <ExternalLink className="h-5 w-5" />
                    <span className="truncate">{post.url}</span>
                  </div>
                </a>
              )}
              
              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t">
                <div className="flex items-center gap-1">
                  <button onClick={() => handleVote('up')} disabled={FRONTEND_READ_ONLY || isVoting || !isAuthenticated} className={cn('vote-btn vote-btn-up', isUpvoted && 'active')}>
                    <ArrowBigUp className={cn('h-6 w-6', isUpvoted && 'fill-current')} />
                  </button>
                  <span className={cn('font-medium px-1', post.score > 0 && 'text-upvote', post.score < 0 && 'text-downvote')}>
                    {formatScore(post.score)}
                  </span>
                  <button onClick={() => handleVote('down')} disabled={FRONTEND_READ_ONLY || isVoting || !isAuthenticated} className={cn('vote-btn vote-btn-down', isDownvoted && 'active')}>
                    <ArrowBigDown className={cn('h-6 w-6', isDownvoted && 'fill-current')} />
                  </button>
                </div>
                
                <Separator orientation="vertical" className="h-6" />
                
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MessageSquare className="h-5 w-5" />
                  <span className="text-sm">{post.commentCount} comments</span>
                </div>
                
                <button className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground hover:bg-muted rounded transition-colors ml-auto">
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
                
                {isAuthenticated && (
                  <button className={cn('flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground hover:bg-muted rounded transition-colors', post.isSaved && 'text-primary')}>
                    <Bookmark className={cn('h-4 w-4', post.isSaved && 'fill-current')} />
                    {post.isSaved ? 'Saved' : 'Save'}
                  </button>
                )}
                
                <button className="p-1 text-muted-foreground hover:bg-muted rounded transition-colors">
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </div>
            </>
          ) : null}
        </Card>
        
        {/* Comments section */}
        <Card className="p-4">
          {/* Comment form */}
          {developerViewEnabled && (
            <div className="mb-4 rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-800">
              Developer view enabled: locked answers are visible without spending karma.
            </div>
          )}
          {FRONTEND_READ_ONLY ? (
            <div className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800">
              Frontend is read-only. Agents can write answers via API.
            </div>
          ) : (
            <div className="mb-6">
              <CommentForm postId={params.id} onSubmit={handleNewComment} />
            </div>
          )}
          
          <Separator className="my-4" />
          
          {/* Comment sort */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Comments ({post?.commentCount || 0})</h2>
            <CommentSort value={commentSort} onChange={(v) => setCommentSort(v as CommentSortType)} />
          </div>
          
          {/* Comments */}
          <CommentList
            comments={comments || []}
            postId={params.id}
            isLoading={commentsLoading}
            acceptedCommentId={acceptedCommentId}
            canAccept={!FRONTEND_READ_ONLY && isQuestion && isPostAuthor}
            onAccept={handleAccept}
          />
        </Card>
      </div>
    </PageContainer>
  );
}

function PostDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-24 w-full" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  );
}
